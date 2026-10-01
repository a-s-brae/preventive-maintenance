"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { checklistFromForm, draftAnswers, NOTE_MAX, parseAnswer, parseChecklist, resultsFromForm, type ChecklistResult } from "@/lib/checklist";
import { assetSchema, completeSchema, firstError, optNumber, taskSchema, workOrderSchema, type FormState } from "@/lib/forms";
import { loadSampleData } from "@/lib/sample-data";
import { nextFixedCycle } from "@/lib/schedule";
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
  const data = { ...parsed.data, assetTag: parsed.data.assetTag ?? null };

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
  redirect(`/assets/${ids.assetId}`);
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
  redirect(`/assets/${task.assetId}`);
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
    id = (await db.workOrder.create({ data: { ...data, type: w.type, assetId: w.assetId, createdById: user.id } })).id;
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
  const { performedAt, meterReading, notes } = parsed.data;

  try {
    await db.$transaction(async (tx) => {
      const wo = await tx.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
      if (wo.status === "COMPLETE") throw new FormError("This work order is already complete");

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
