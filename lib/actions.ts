"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { checklistFromForm, draftAnswers, NOTE_MAX, parseAnswer, parseChecklist, resultsFromForm, type ChecklistResult } from "@/lib/checklist";
import { endDowntime, startDowntime } from "@/lib/downtime";
import {
  approveSchema,
  assetSchema,
  completeSchema,
  downSchema,
  firstError,
  locationSchema,
  optNumber,
  rejectSchema,
  requestSchema,
  taskSchema,
  workOrderSchema,
  type FormState,
} from "@/lib/forms";
import { loadSampleData } from "@/lib/sample-data";
import { nextFixedCycle } from "@/lib/schedule";
import { wouldCycle } from "@/lib/tree";
import { openPmWorkOrder, refreshOpenPmWorkOrder, syncPmWorkOrders } from "@/lib/work-orders";

const fields = (fd: FormData) => Object.fromEntries(fd.entries());

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export async function saveAsset(assetId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const parsed = assetSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = {
    ...parsed.data,
    assetTag: parsed.data.assetTag ?? null,
    locationId: parsed.data.locationId ?? null,
    parentId: parsed.data.parentId ?? null,
  };
  if (assetId && data.parentId) {
    const all = await db.asset.findMany({ select: { id: true, parentId: true, name: true } });
    if (wouldCycle(all, assetId, data.parentId)) return { error: "An asset can't sit under itself or one of its own sub-assets" };
  }

  let id: string;
  try {
    if (assetId) {
      id = (await db.asset.update({ where: { id: assetId }, data })).id;
    } else {
      id = (await db.asset.create({ data })).id;
    }
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Asset tag "${data.assetTag}" is already in use` };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/assets/${id}`);
}

export async function loadSampleAssets() {
  await requireUser();
  await db.$transaction((tx) => loadSampleData(tx));
  await syncPmWorkOrders(db);
  revalidatePath("/", "layout");
}

export async function deleteAsset(assetId: string) {
  await requireUser();
  await db.asset.delete({ where: { id: assetId } });
  revalidatePath("/", "layout");
  redirect("/assets");
}

// ─── Meter readings ─────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

/** Record a reading and bump the asset's current meter. Readings must not go
 *  backwards — a replaced hour meter should be handled by editing the tasks'
 *  baselines, not by entering a lower number. */
async function applyMeterReading(tx: Tx, assetId: string, value: number, userId: string, at: Date) {
  const asset = await tx.asset.findUniqueOrThrow({ where: { id: assetId } });
  if (asset.currentMeter != null && value < asset.currentMeter) {
    throw new MeterError(`Reading ${value} is below the current meter (${asset.currentMeter})`);
  }
  await tx.meterReading.create({ data: { assetId, value, recordedById: userId, recordedAt: at } });
  await tx.asset.update({ where: { id: assetId }, data: { currentMeter: value, meterUpdatedAt: at } });
}

class MeterError extends Error {}

export async function recordMeter(assetId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const value = optNumber.safeParse(fd.get("value"));
  if (!value.success || value.data == null) return { error: "Enter a meter reading" };
  try {
    await db.$transaction((tx) => applyMeterReading(tx, assetId, value.data!, user.id, new Date()));
  } catch (e) {
    if (e instanceof MeterError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return {};
}

// ─── PM schedules ───────────────────────────────────────────────────────────

export async function saveTask(
  ids: { assetId: string; taskId: string | null },
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = taskSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const checklist = checklistFromForm(fd.get("checklist"));
  if (!checklist) return { error: "The checklist couldn't be read — please try again" };
  const t = parsed.data;
  const data = {
    title: t.title,
    instructions: t.instructions ?? null,
    checklist,
    calendarEvery: t.calendarEvery ?? null,
    calendarUnit: t.calendarUnit ?? null,
    usageEvery: t.usageEvery ?? null,
    scheduleBasis: t.scheduleBasis,
    startDate: t.startDate,
    startMeter: t.startMeter ?? null,
    dueSoonDays: t.dueSoonDays,
    estimatedMinutes: t.estimatedMinutes ?? null,
    priority: t.priority,
    defaultAssigneeId: t.defaultAssigneeId ?? null,
    active: t.active,
  };

  await db.$transaction(async (tx) => {
    const existing = ids.taskId ? await tx.pmTask.findUniqueOrThrow({ where: { id: ids.taskId } }) : null;
    // Fixed schedules: point at the first occurrence after the last time it
    // was done, so changing the start date or interval re-aligns the calendar.
    const fixedCycle = existing?.lastDoneAt ? nextFixedCycle(data, -1, existing.lastDoneAt) : 0;
    const task = existing
      ? await tx.pmTask.update({ where: { id: existing.id }, data: { ...data, fixedCycle } })
      : await tx.pmTask.create({ data: { ...data, fixedCycle, assetId: ids.assetId } });
    await refreshOpenPmWorkOrder(tx, task.id);
  });
  await syncPmWorkOrders(db);
  revalidatePath("/", "layout");
  redirect(`/assets/${ids.assetId}?tab=pm`);
}

export async function deleteTask(taskId: string) {
  await requireUser();
  const task = await db.$transaction(async (tx) => {
    // Drop its not-yet-started work order; keep any that are underway.
    await tx.workOrder.deleteMany({ where: { openForTaskId: taskId, status: "OPEN" } });
    await tx.workOrder.updateMany({ where: { openForTaskId: taskId }, data: { openForTaskId: null } });
    return tx.pmTask.delete({ where: { id: taskId } });
  });
  revalidatePath("/", "layout");
  redirect(`/assets/${task.assetId}?tab=pm`);
}

/** Create a PM schedule's work order now, before it comes due. */
export async function startPmNow(taskId: string) {
  await requireUser();
  const wo = await openPmWorkOrder(db, taskId);
  revalidatePath("/", "layout");
  redirect(`/work-orders/${wo.id}`);
}

// ─── Work orders ────────────────────────────────────────────────────────────

export async function saveWorkOrder(workOrderId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = workOrderSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const w = parsed.data;
  const data = {
    title: w.title,
    description: w.description ?? null,
    priority: w.priority,
    dueDate: w.dueDate ?? null,
    assignedToId: w.assignedToId ?? null,
  };

  let id: string;
  if (workOrderId) {
    const existing = await db.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
    // A PM work order's type and asset come from its schedule.
    const manual = existing.type === "PM" ? {} : { type: w.type, assetId: w.assetId };
    id = (await db.workOrder.update({ where: { id: workOrderId }, data: { ...data, ...manual } })).id;
  } else {
    id = await db.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({ data: { ...data, type: w.type, assetId: w.assetId, createdById: user.id } });
      if (w.assetDown) await startDowntime(tx, { assetId: w.assetId, userId: user.id, reason: w.title, workOrderId: wo.id });
      return wo.id;
    });
  }
  revalidatePath("/", "layout");
  redirect(`/work-orders/${id}`);
}

export async function setWorkOrderStatus(workOrderId: string, status: "OPEN" | "IN_PROGRESS" | "ON_HOLD") {
  await requireUser();
  const wo = await db.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.status === "COMPLETE") return;
  await db.workOrder.update({
    where: { id: workOrderId },
    data: { status, startedAt: status === "IN_PROGRESS" ? (wo.startedAt ?? new Date()) : wo.startedAt },
  });
  revalidatePath("/", "layout");
}

/** Save one checklist answer (and its note) on an open work order as it's
 *  entered, so a half-done PM keeps its answers. The first answer starts the
 *  work order. Returns `started` when it moved the work order to In progress. */
export async function saveChecklistAnswer(
  workOrderId: string,
  index: number,
  raw: string,
  note: string,
): Promise<{ error?: string; started?: boolean }> {
  await requireUser();
  try {
    return await db.$transaction(async (tx) => {
      // Lock the row: two people answering different items at once must not
      // overwrite each other's answers.
      await tx.$queryRaw`SELECT id FROM "WorkOrder" WHERE id = ${workOrderId} FOR UPDATE`;
      const wo = await tx.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
      if (wo.status === "COMPLETE") throw new FormError("This work order is already complete");
      const items = parseChecklist(wo.checklist);
      const item = items[index];
      if (!item) throw new FormError("That checklist item no longer exists — reload the page");
      const answer = parseAnswer(item, raw);
      if ("error" in answer) throw new FormError(answer.error);

      const drafts = draftAnswers(items, wo.checklistResults);
      const results: ChecklistResult[] = items.map((it, i) => ({
        ...it,
        value: drafts[i]?.value ?? (it.type === "CHECK" ? false : null),
        ...(drafts[i]?.note && { note: drafts[i]!.note }),
      }));
      const trimmed = note.trim().slice(0, NOTE_MAX);
      results[index] = { ...item, value: answer.value, ...(trimmed && { note: trimmed }) };

      const start = wo.status === "OPEN";
      await tx.workOrder.update({
        where: { id: wo.id },
        data: { checklistResults: results, ...(start && { status: "IN_PROGRESS", startedAt: wo.startedAt ?? new Date() }) },
      });
      return { started: start };
    });
  } catch (e) {
    if (e instanceof FormError) return { error: e.message };
    throw e;
  }
}

/** Complete a work order. For PM work orders this also resets the schedule,
 *  and creates the next work order right away if it's already due. */
export async function completeWorkOrder(workOrderId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = completeSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { performedAt, meterReading, notes, assetUp } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
      if (wo.status === "COMPLETE") throw new FormError("This work order is already complete");
      // Back up now if done today; a back-dated completion ends the downtime on that day.
      if (assetUp) await endDowntime(tx, wo.assetId, user.id, isToday(performedAt) ? new Date() : performedAt);

      const { results, error } = resultsFromForm(parseChecklist(wo.checklist), fd);
      if (error) throw new FormError(error);

      if (meterReading != null) await applyMeterReading(tx, wo.assetId, meterReading, user.id, performedAt);

      await tx.workOrder.update({
        where: { id: wo.id },
        data: {
          status: "COMPLETE",
          openForTaskId: null,
          startedAt: wo.startedAt ?? performedAt,
          completedAt: performedAt,
          completedById: user.id,
          meterReading: meterReading ?? null,
          completionNotes: notes ?? null,
          checklistResults: results,
        },
      });

      if (wo.pmTaskId) {
        const task = await tx.pmTask.findUnique({ where: { id: wo.pmTaskId } });
        const asset = await tx.asset.findUniqueOrThrow({ where: { id: wo.assetId } });
        if (task) {
          await tx.pmTask.update({
            where: { id: task.id },
            data: {
              lastDoneAt: performedAt,
              lastDoneMeter: meterReading ?? asset.currentMeter,
              ...(task.scheduleBasis === "FIXED" && { fixedCycle: nextFixedCycle(task, wo.cycle ?? task.fixedCycle, performedAt) }),
            },
          });
        }
      }
    });
  } catch (e) {
    if (e instanceof MeterError || e instanceof FormError) return { error: e.message };
    throw e;
  }

  await syncPmWorkOrders(db);
  revalidatePath("/", "layout");
  redirect(`/work-orders/${workOrderId}`);
}

class FormError extends Error {}

/** Only hand-made work orders can be deleted; PM ones come back while the PM is due. */
export async function deleteWorkOrder(workOrderId: string) {
  await requireUser();
  const wo = await db.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.type === "PM") return;
  await db.workOrder.delete({ where: { id: workOrderId } });
  revalidatePath("/", "layout");
  redirect("/work-orders");
}

const isToday = (d: Date) => d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);

// ─── Locations ──────────────────────────────────────────────────────────────

export async function saveLocation(locationId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requireUser();
  const parsed = locationSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const data = { name: parsed.data.name, parentId: parsed.data.parentId ?? null, notes: parsed.data.notes ?? null };
  const all = await db.location.findMany({ select: { id: true, parentId: true, name: true } });
  if (locationId && wouldCycle(all, locationId, data.parentId)) return { error: "A location can't sit inside itself or one of its own sub-locations" };
  const sibling = all.find((l) => l.parentId === data.parentId && l.name.toLowerCase() === data.name.toLowerCase() && l.id !== locationId);
  if (sibling) return { error: `There's already a "${sibling.name}" here` };

  const id = locationId
    ? (await db.location.update({ where: { id: locationId }, data })).id
    : (await db.location.create({ data })).id;
  revalidatePath("/", "layout");
  redirect(`/locations/${id}`);
}

/** Delete an empty location. Ones with sub-locations or assets must be emptied first. */
export async function deleteLocation(locationId: string, _prev: FormState, _fd: FormData): Promise<FormState> {
  await requireUser();
  const loc = await db.location.findUniqueOrThrow({ where: { id: locationId }, include: { _count: { select: { children: true, assets: true } } } });
  if (loc._count.children || loc._count.assets) {
    return { error: `Move its ${loc._count.children} sub-location(s) and ${loc._count.assets} asset(s) somewhere else first` };
  }
  await db.location.delete({ where: { id: locationId } });
  revalidatePath("/", "layout");
  redirect(loc.parentId ? `/locations/${loc.parentId}` : "/locations");
}

// ─── Downtime ───────────────────────────────────────────────────────────────

export async function markAssetDown(assetId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = downSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await startDowntime(db, { assetId, userId: user.id, reason: parsed.data.reason });
  revalidatePath("/", "layout");
  return {};
}

export async function markAssetUp(assetId: string) {
  const user = await requireUser();
  await endDowntime(db, assetId, user.id);
  revalidatePath("/", "layout");
}

// ─── Requests ───────────────────────────────────────────────────────────────

export async function createRequest(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = requestSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const r = parsed.data;
  if (r.assetDown && !r.assetId) return { error: "Pick the machine that's down, so it can be logged as down" };

  const request = await db.$transaction(async (tx) => {
    const req = await tx.request.create({
      data: {
        title: r.title,
        description: r.description ?? null,
        assetId: r.assetId ?? null,
        locationId: r.locationId ?? null,
        priority: r.priority,
        assetDown: r.assetDown,
        requestedById: user.id,
      },
    });
    // Downtime starts when it's reported, not when someone gets round to approving it.
    if (r.assetDown && r.assetId) await startDowntime(tx, { assetId: r.assetId, userId: user.id, reason: r.title, requestId: req.id });
    return req;
  });
  revalidatePath("/", "layout");
  redirect(`/requests/${request.id}?submitted=1`);
}

/** Approve a request: create its work order and link any downtime to it. */
export async function approveRequest(requestId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = approveSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const a = parsed.data;

  let workOrderId: string;
  try {
    workOrderId = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Request" WHERE id = ${requestId} FOR UPDATE`;
      const req = await tx.request.findUniqueOrThrow({ where: { id: requestId }, include: { requestedBy: true } });
      if (req.status !== "PENDING") throw new FormError("This request has already been reviewed");
      const by = req.requestedBy ? (req.requestedBy.name ?? req.requestedBy.email) : "someone";
      const wo = await tx.workOrder.create({
        data: {
          type: "REPAIR",
          title: req.title,
          description: [req.description, `Requested by ${by}.`, a.note].filter(Boolean).join("\n\n"),
          assetId: a.assetId,
          priority: a.priority,
          dueDate: a.dueDate ?? null,
          assignedToId: a.assignedToId ?? null,
          createdById: user.id,
        },
      });
      await tx.request.update({
        where: { id: req.id },
        data: { status: "APPROVED", reviewedById: user.id, reviewedAt: new Date(), reviewNote: a.note ?? null, workOrderId: wo.id, assetId: a.assetId },
      });
      // Reported down: the downtime started at submission (or starts now, back-dated
      // to the report, if no asset was picked then).
      if (req.assetDown) {
        await startDowntime(tx, { assetId: a.assetId, userId: req.requestedById, reason: req.title, workOrderId: wo.id, requestId: req.id, at: req.createdAt });
      }
      await tx.downtime.updateMany({ where: { requestId: req.id, workOrderId: null }, data: { workOrderId: wo.id } });
      return wo.id;
    });
  } catch (e) {
    if (e instanceof FormError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/work-orders/${workOrderId}`);
}

export async function rejectRequest(requestId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = rejectSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { count } = await db.request.updateMany({
    where: { id: requestId, status: "PENDING" },
    data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date(), reviewNote: parsed.data.note },
  });
  if (count === 0) return { error: "This request has already been reviewed" };
  revalidatePath("/", "layout");
  redirect(`/requests/${requestId}`);
}
