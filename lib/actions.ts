"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requirePermission, requireUser } from "@/auth";
import { db } from "@/lib/db";
import { checklistFromForm, draftAnswers, findProblems, NOTE_MAX, parseAnswer, parseChecklist, resultsFromForm, type ChecklistResult } from "@/lib/checklist";
import { endDowntime, startDowntime } from "@/lib/downtime";
import { headers } from "next/headers";
import { sendDigests } from "@/lib/digest";
import { minutesBetween, runningKey } from "@/lib/labor";
import { adjustStock, StockError } from "@/lib/parts";
import { can } from "@/lib/permissions";
import {
  approveSchema,
  assetSchema,
  completeSchema,
  countSchema,
  laborSchema,
  partSchema,
  restockSchema,
  usePartSchema,
  downSchema,
  firstError,
  locationSchema,
  optNumber,
  rejectSchema,
  requestSchema,
  taskSchema,
  templateSchema,
  workOrderSchema,
  type FormState,
} from "@/lib/forms";
import { MAX_IMPORT_BYTES, missingLocations, parseCsv, planAssetImport, planPartImport, summarizePlan } from "@/lib/csv-import";
import { runAssetImport, runPartImport } from "@/lib/import-run";
import { adminIds, notify } from "@/lib/notify";
import { loadSampleData } from "@/lib/sample-data";
import { nextFixedCycle } from "@/lib/schedule";
import { wouldCycle } from "@/lib/tree";
import { followUpFor, openPmWorkOrder, refreshOpenPmWorkOrder, syncPmWorkOrders, woNumber } from "@/lib/work-orders";
import { requestNumber } from "@/lib/downtime";

const fields = (fd: FormData) => Object.fromEntries(fd.entries());

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export async function saveAsset(assetId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("manage");
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
  await requirePermission("manage");
  await db.$transaction((tx) => loadSampleData(tx));
  await syncPmWorkOrders(db);
  revalidatePath("/", "layout");
}

export async function deleteAsset(assetId: string) {
  await requirePermission("manage");
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
  const user = await requirePermission("work");
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
  await requirePermission("manage");
  const parsed = taskSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  // A PM that uses a template takes the template's checklist as it is now.
  const templateId = String(fd.get("checklistTemplateId") ?? "");
  const template = templateId ? await db.checklistTemplate.findUnique({ where: { id: templateId } }) : null;
  if (templateId && !template) return { error: "That checklist template no longer exists — pick another" };
  const checklist = template ? parseChecklist(template.items) : checklistFromForm(fd.get("checklist"));
  if (!checklist) return { error: "The checklist couldn't be read — please try again" };
  const t = parsed.data;
  const data = {
    title: t.title,
    instructions: t.instructions ?? null,
    checklist,
    checklistTemplateId: template?.id ?? null,
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
  await requirePermission("manage");
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
  await requirePermission("work");
  const wo = await openPmWorkOrder(db, taskId);
  revalidatePath("/", "layout");
  redirect(`/work-orders/${wo.id}`);
}

// ─── Work orders ────────────────────────────────────────────────────────────

export async function saveWorkOrder(workOrderId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("work");
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
    id = await db.$transaction(async (tx) => {
      const existing = await tx.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
      // A PM work order's type and asset come from its schedule.
      const manual = existing.type === "PM" ? {} : { type: w.type, assetId: w.assetId };
      const wo = await tx.workOrder.update({ where: { id: workOrderId }, data: { ...data, ...manual } });
      if (wo.assignedToId !== existing.assignedToId) await notifyAssigned(tx, wo, user.id);
      return wo.id;
    });
  } else {
    id = await db.$transaction(async (tx) => {
      const wo = await tx.workOrder.create({ data: { ...data, type: w.type, assetId: w.assetId, createdById: user.id } });
      if (w.assetDown) await startDowntime(tx, { assetId: w.assetId, userId: user.id, reason: w.title, workOrderId: wo.id });
      await notifyAssigned(tx, wo, user.id);
      return wo.id;
    });
  }
  revalidatePath("/", "layout");
  redirect(`/work-orders/${id}`);
}

/** Tell the assignee (if it isn't the person doing the assigning). */
function notifyAssigned(tx: Tx, wo: { id: string; number: number; title: string; assignedToId: string | null }, actorId: string) {
  return notify(tx, [wo.assignedToId], { title: `${woNumber(wo.number)} assigned to you: ${wo.title}`, href: `/work-orders/${wo.id}` }, actorId);
}

export async function setWorkOrderStatus(workOrderId: string, status: "OPEN" | "IN_PROGRESS" | "ON_HOLD") {
  await requirePermission("work");
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
  await requirePermission("work");
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
  const user = await requirePermission("work");
  const parsed = completeSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { performedAt, meterReading, notes, assetUp } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
      if (wo.status === "COMPLETE") throw new FormError("This work order is already complete");
      // Back up now if done today; a back-dated completion ends the downtime on that day.
      if (assetUp) await endDowntime(tx, wo.assetId, user.id, isToday(performedAt) ? new Date() : performedAt);
      // Stop anyone's timer still running on it.
      const running = await tx.laborEntry.findMany({ where: { workOrderId: wo.id, endedAt: null } });
      const now = new Date();
      for (const e of running) {
        await tx.laborEntry.update({ where: { id: e.id }, data: { endedAt: now, minutes: minutesBetween(e.startedAt, now), runningKey: null } });
      }

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

      // Problems found on an inspection become a repair work order, if asked for.
      const problems = findProblems(results);
      if (problems.length && fd.get("followUp") === "on") {
        const fu = await tx.workOrder.create({ data: { ...followUpFor(wo, problems, performedAt), createdById: user.id } });
        await notify(
          tx,
          await adminIds(tx),
          { title: `Follow-up ${woNumber(fu.number)} raised from ${woNumber(wo.number)}: ${wo.title}`, body: problems.join("; "), href: `/work-orders/${fu.id}` },
          user.id,
        );
      }

      // Let whoever reported the problem know it's been fixed.
      const req = await tx.request.findUnique({ where: { workOrderId: wo.id } });
      if (req) {
        await notify(tx, [req.requestedById], { title: `Done: your request ${requestNumber(req.number)} — ${req.title}`, href: `/requests/${req.id}` }, user.id);
      }

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
  await requirePermission("manage");
  const wo = await db.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.type === "PM") return;
  await db.workOrder.delete({ where: { id: workOrderId } });
  revalidatePath("/", "layout");
  redirect("/work-orders");
}

const isToday = (d: Date) => d.toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);

// ─── Locations ──────────────────────────────────────────────────────────────

export async function saveLocation(locationId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("manage");
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
  await requirePermission("manage");
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
  const user = await requirePermission("work");
  const parsed = downSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await startDowntime(db, { assetId, userId: user.id, reason: parsed.data.reason });
  revalidatePath("/", "layout");
  return {};
}

export async function markAssetUp(assetId: string) {
  const user = await requirePermission("work");
  await endDowntime(db, assetId, user.id);
  revalidatePath("/", "layout");
}

// ─── Requests ───────────────────────────────────────────────────────────────

export async function createRequest(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("report");
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
    await notify(
      tx,
      await adminIds(tx),
      {
        title: `New request ${requestNumber(req.number)}${r.assetDown ? " (machine down)" : ""}: ${req.title}`,
        body: `From ${user.name ?? user.email}`,
        href: `/requests/${req.id}`,
      },
      user.id,
    );
    return req;
  });
  revalidatePath("/", "layout");
  redirect(`/requests/${request.id}?submitted=1`);
}

/** Approve a request: create its work order and link any downtime to it. */
export async function approveRequest(requestId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("review");
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
      await notify(
        tx,
        [req.requestedById],
        { title: `Your request ${requestNumber(req.number)} was approved: ${req.title}`, body: `Work order ${woNumber(wo.number)} was created for it.`, href: `/requests/${req.id}` },
        user.id,
      );
      await notifyAssigned(tx, wo, user.id);
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
  const user = await requirePermission("review");
  const parsed = rejectSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const count = await db.$transaction(async (tx) => {
    const { count } = await tx.request.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "REJECTED", reviewedById: user.id, reviewedAt: new Date(), reviewNote: parsed.data.note },
    });
    if (count) {
      const req = await tx.request.findUniqueOrThrow({ where: { id: requestId } });
      await notify(
        tx,
        [req.requestedById],
        { title: `Your request ${requestNumber(req.number)} was not approved: ${req.title}`, body: parsed.data.note, href: `/requests/${req.id}` },
        user.id,
      );
    }
    return count;
  });
  if (count === 0) return { error: "This request has already been reviewed" };
  revalidatePath("/", "layout");
  redirect(`/requests/${requestId}`);
}

// ─── Parts & stock ──────────────────────────────────────────────────────────

export async function savePart(partId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("manage");
  const parsed = partSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { quantity, ...p } = parsed.data;
  const data = {
    ...p,
    partNumber: p.partNumber ?? null,
    description: p.description ?? null,
    minQuantity: p.minQuantity ?? null,
    unitCost: p.unitCost ?? null,
    storageLocation: p.storageLocation ?? null,
    vendor: p.vendor ?? null,
    notes: p.notes ?? null,
  };
  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      if (partId) return (await tx.part.update({ where: { id: partId }, data })).id;
      const part = await tx.part.create({ data });
      if (quantity) await adjustStock(tx, { partId: part.id, reason: "ADJUST", setTo: quantity, userId: user.id, note: "Starting stock" });
      return part.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Part number "${data.partNumber}" is already used by another part` };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/parts/${id}`);
}

export async function restockPart(partId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("work");
  const parsed = restockSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const r = parsed.data;
  await db.$transaction((tx) =>
    adjustStock(tx, { partId, reason: "RESTOCK", change: r.quantity, unitCost: r.unitCost ?? null, note: r.note ?? null, userId: user.id }),
  );
  revalidatePath("/", "layout");
  return {};
}

/** Correct the stock after a physical count. */
export async function countPart(partId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("work");
  const parsed = countSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await db.$transaction((tx) =>
    adjustStock(tx, { partId, reason: "ADJUST", setTo: parsed.data.counted, note: parsed.data.note ?? "Counted", userId: user.id }),
  );
  revalidatePath("/", "layout");
  return {};
}

/** Record parts used on a work order; they come out of stock. */
export async function usePart(workOrderId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("work");
  const parsed = usePartSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { partId, quantity } = parsed.data;
  try {
    await db.$transaction(async (tx) => {
      const part = await adjustStock(tx, { partId, reason: "USED", change: -quantity, workOrderId, userId: user.id });
      await tx.partUsage.create({ data: { workOrderId, partId, quantity, unitCost: part.unitCost, usedById: user.id } });
    });
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return {};
}

/** Take a part line off a work order and put the parts back in stock. */
export async function removePartUsage(usageId: string) {
  const user = await requirePermission("work");
  await db.$transaction(async (tx) => {
    const usage = await tx.partUsage.delete({ where: { id: usageId } });
    await adjustStock(tx, { partId: usage.partId, reason: "RETURNED", change: usage.quantity, workOrderId: usage.workOrderId, userId: user.id });
  });
  revalidatePath("/", "layout");
}

// ─── Labor ──────────────────────────────────────────────────────────────────

/** Start my timer on a work order (and start the work order). */
export async function startTimer(workOrderId: string) {
  const user = await requirePermission("work");
  await db.$transaction(async (tx) => {
    const wo = await tx.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
    if (wo.status === "COMPLETE") return;
    await tx.laborEntry.createMany({
      data: [{ workOrderId, userId: user.id, startedAt: new Date(), runningKey: runningKey(user.id, workOrderId) }],
      skipDuplicates: true,
    });
    if (wo.status !== "IN_PROGRESS") {
      await tx.workOrder.update({ where: { id: wo.id }, data: { status: "IN_PROGRESS", startedAt: wo.startedAt ?? new Date() } });
    }
  });
  revalidatePath("/", "layout");
}

export async function stopTimer(workOrderId: string) {
  const user = await requirePermission("work");
  const entry = await db.laborEntry.findUnique({ where: { runningKey: runningKey(user.id, workOrderId) } });
  if (entry) {
    const now = new Date();
    await db.laborEntry.update({ where: { id: entry.id }, data: { endedAt: now, minutes: minutesBetween(entry.startedAt, now), runningKey: null } });
  }
  revalidatePath("/", "layout");
}

/** Log time after the fact. */
export async function addLabor(workOrderId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requirePermission("work");
  const parsed = laborSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { date, total, note } = parsed.data;
  await db.laborEntry.create({
    data: { workOrderId, userId: user.id, startedAt: date, endedAt: new Date(date.getTime() + total * 60_000), minutes: total, note: note ?? null },
  });
  revalidatePath("/", "layout");
  return {};
}

/** People can remove their own time entries; admins can remove anyone's. */
export async function deleteLabor(entryId: string) {
  const user = await requirePermission("work");
  const entry = await db.laborEntry.findUniqueOrThrow({ where: { id: entryId } });
  if (entry.userId !== user.id && !can(user.role, "manage")) return;
  await db.laborEntry.delete({ where: { id: entryId } });
  revalidatePath("/", "layout");
}

// ─── Attachments ────────────────────────────────────────────────────────────

/** Uploaders can delete their own files; admins can delete any. */
export async function deleteAttachment(attachmentId: string) {
  const user = await requirePermission("work");
  const a = await db.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
  if (a.uploadedById !== user.id && !can(user.role, "manage")) return;
  await db.attachment.delete({ where: { id: attachmentId } });
  revalidatePath("/", "layout");
}

// ─── People ─────────────────────────────────────────────────────────────────

export async function updatePerson(userId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requirePermission("people");
  const role = String(fd.get("role") ?? "");
  if (role !== "ADMIN" && role !== "TECH" && role !== "REQUESTER") return { error: "Pick a role" };
  const active = fd.get("active") === "on";
  const emailDigest = fd.get("emailDigest") === "on";
  const name = String(fd.get("name") ?? "").trim().slice(0, 100) || null;

  const losingAdmin = role !== "ADMIN" || !active;
  if (losingAdmin) {
    const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const admins = await db.user.count({ where: { role: "ADMIN", active: true } });
    if (target.role === "ADMIN" && target.active && admins <= 1) return { error: "There has to be at least one active admin" };
  }
  await db.user.update({ where: { id: userId }, data: { role, active, emailDigest, name } });
  // Deactivating signs them out everywhere.
  if (!active) await db.session.deleteMany({ where: { userId } });
  revalidatePath("/", "layout");
  // Someone who just took away their own admin role can't stay on the people page.
  if (userId === me.id && role !== "ADMIN") redirect("/");
  return {};
}

/** Send everyone's daily email now (normally it goes out each weekday morning). */
export async function sendDigestNow() {
  await requirePermission("people");
  const h = await headers();
  const base = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const r = await sendDigests(base);
  const qs = new URLSearchParams({ sent: String(r.sent), skipped: String(r.skipped), ...(r.errors.length && { error: r.errors[0] }) });
  redirect(`/people?${qs}`);
}

// ─── Checklist templates ────────────────────────────────────────────────────

/** Save a template. PM schedules that use it get the new checklist, and so do
 *  their work orders that haven't been started. */
export async function saveTemplate(templateId: string | null, _prev: FormState, fd: FormData): Promise<FormState> {
  await requirePermission("manage");
  const parsed = templateSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const items = checklistFromForm(fd.get("checklist"));
  if (!items) return { error: "The checklist couldn't be read — please try again" };
  if (items.length === 0) return { error: "Add at least one checklist item" };
  const data = { name: parsed.data.name, description: parsed.data.description ?? null, items };
  const clash = await db.checklistTemplate.findFirst({
    where: { name: { equals: data.name, mode: "insensitive" }, ...(templateId && { id: { not: templateId } }) },
  });
  if (clash) return { error: `There's already a template called "${clash.name}"` };

  let id: string;
  try {
    id = await db.$transaction(async (tx) => {
      const t = templateId ? await tx.checklistTemplate.update({ where: { id: templateId }, data }) : await tx.checklistTemplate.create({ data });
      const tasks = await tx.pmTask.findMany({ where: { checklistTemplateId: t.id }, select: { id: true } });
      for (const task of tasks) {
        await tx.pmTask.update({ where: { id: task.id }, data: { checklist: items } });
        await refreshOpenPmWorkOrder(tx, task.id);
      }
      return t.id;
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `There's already a template called "${data.name}"` };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/checklists/${id}?saved=1`);
}

/** Delete a template. PM schedules using it keep their current checklist. */
export async function deleteTemplate(templateId: string) {
  await requirePermission("manage");
  await db.checklistTemplate.delete({ where: { id: templateId } });
  revalidatePath("/", "layout");
  redirect("/checklists");
}

// ─── Notifications ──────────────────────────────────────────────────────────

export async function markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

// ─── CSV import ─────────────────────────────────────────────────────────────

export type ImportKind = "assets" | "parts";

async function planImport(kind: ImportKind, text: string) {
  if (text.length > MAX_IMPORT_BYTES) return { plan: null, error: "That file is too big — import up to 2 MB at a time." };
  const table = parseCsv(text);
  if (kind === "assets") {
    const [assets, locations] = await Promise.all([
      db.asset.findMany({ select: { id: true, name: true, assetTag: true, parentId: true, currentMeter: true } }),
      db.location.findMany({ select: { id: true, name: true, parentId: true } }),
    ]);
    const plan = planAssetImport(table, assets);
    return { plan, newLocations: missingLocations(plan, locations).map((p) => p.join(" › ")) };
  }
  const parts = await db.part.findMany({ select: { id: true, name: true, partNumber: true, quantity: true } });
  return { plan: planPartImport(table, parts), newLocations: [] };
}

export type ImportPreview = {
  error?: string;
  errors: string[];
  columns: string[];
  ignored: string[];
  newLocations: string[];
  summary: { create: number; update: number; skip: number };
  rows: { line: number; name: string; action: "create" | "update" | "skip"; messages: string[] }[];
};

/** Check a CSV file and say what importing it would do. Changes nothing. */
export async function previewImport(kind: ImportKind, text: string): Promise<ImportPreview> {
  await requirePermission("manage");
  const { plan, newLocations = [], error } = await planImport(kind, text);
  if (!plan) return { error, errors: [], columns: [], ignored: [], newLocations: [], summary: { create: 0, update: 0, skip: 0 }, rows: [] };
  return {
    errors: plan.errors,
    columns: plan.columns,
    ignored: plan.ignored,
    newLocations,
    summary: summarizePlan(plan),
    rows: plan.rows.map(({ line, name, action, messages }) => ({ line, name, action, messages })),
  };
}

/** Import a CSV file: the rows the preview showed as create / update. */
export async function runImport(kind: ImportKind, text: string): Promise<{ error?: string; created?: number; updated?: number; locationsCreated?: number }> {
  const user = await requirePermission("manage");
  const { plan, error } = await planImport(kind, text);
  if (!plan) return { error };
  if (plan.errors.length) return { error: plan.errors[0] };
  try {
    const result = kind === "assets" ? await runAssetImport(plan, user.id) : await runPartImport(plan, user.id);
    revalidatePath("/", "layout");
    return result;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "Another change to the same asset tags or part numbers happened at the same time. Check the preview again and re-import." };
    throw e;
  }
}
