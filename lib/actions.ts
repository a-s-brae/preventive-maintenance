"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { loadSampleData } from "@/lib/sample-data";
import { assetSchema, firstError, logSchema, optNumber, taskSchema, type FormState } from "@/lib/forms";

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

// ─── PM tasks ───────────────────────────────────────────────────────────────

export async function saveTask(
  ids: { assetId: string; taskId: string | null },
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = taskSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const t = parsed.data;
  const data = {
    title: t.title,
    instructions: t.instructions ?? null,
    checklist: t.checklist,
    calendarEvery: t.calendarEvery ?? null,
    calendarUnit: t.calendarUnit ?? null,
    usageEvery: t.usageEvery ?? null,
    startDate: t.startDate,
    startMeter: t.startMeter ?? null,
    dueSoonDays: t.dueSoonDays,
    estimatedMinutes: t.estimatedMinutes ?? null,
    active: t.active,
  };

  if (ids.taskId) {
    await db.pmTask.update({ where: { id: ids.taskId }, data });
  } else {
    await db.pmTask.create({ data: { ...data, assetId: ids.assetId } });
  }
  revalidatePath("/", "layout");
  redirect(`/assets/${ids.assetId}`);
}

export async function deleteTask(taskId: string) {
  await requireUser();
  const task = await db.pmTask.delete({ where: { id: taskId } });
  revalidatePath("/", "layout");
  redirect(`/assets/${task.assetId}`);
}

// ─── Work logs ──────────────────────────────────────────────────────────────

/** Log work on an asset. With a taskId it completes that PM and resets its
 *  schedule; without one it records ad-hoc repair / inspection work. */
export async function logWork(
  ids: { assetId: string; taskId: string | null },
  _prev: FormState,
  fd: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = logSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { performedAt, meterReading, notes } = parsed.data;
  const kind = ids.taskId ? "PM" : parsed.data.kind;

  try {
    await db.$transaction(async (tx) => {
      let checklistResults: Prisma.InputJsonValue | undefined;
      if (ids.taskId) {
        const task = await tx.pmTask.findUniqueOrThrow({ where: { id: ids.taskId } });
        checklistResults = task.checklist.map((item, i) => ({ item, done: fd.get(`check-${i}`) === "on" }));
      }

      if (meterReading != null) {
        await applyMeterReading(tx, ids.assetId, meterReading, user.id, performedAt);
      }

      await tx.workLog.create({
        data: {
          kind,
          assetId: ids.assetId,
          taskId: ids.taskId,
          performedAt,
          performedById: user.id,
          meterReading: meterReading ?? null,
          notes: notes ?? null,
          checklistResults,
        },
      });

      if (ids.taskId) {
        const asset = await tx.asset.findUniqueOrThrow({ where: { id: ids.assetId } });
        await tx.pmTask.update({
          where: { id: ids.taskId },
          data: { lastDoneAt: performedAt, lastDoneMeter: meterReading ?? asset.currentMeter },
        });
      }
    });
  } catch (e) {
    if (e instanceof MeterError) return { error: e.message };
    throw e;
  }

  revalidatePath("/", "layout");
  redirect(`/assets/${ids.assetId}`);
}
