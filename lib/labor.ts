// Labor time on work orders. A running timer is a LaborEntry with no endedAt.
import type { LaborEntry } from "@prisma/client";

export const runningKey = (userId: string, workOrderId: string) => `${userId}:${workOrderId}`;

/** Whole minutes between two times, at least 1. */
export function minutesBetween(start: Date, end: Date): number {
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60_000));
}

/** Minutes in an entry; a running timer counts up to `now`. */
export function entryMinutes(e: Pick<LaborEntry, "minutes" | "startedAt" | "endedAt">, now: Date = new Date()): number {
  if (e.minutes != null) return e.minutes;
  return minutesBetween(e.startedAt, e.endedAt ?? now);
}

export const totalMinutes = (entries: Pick<LaborEntry, "minutes" | "startedAt" | "endedAt">[], now: Date = new Date()) =>
  entries.reduce((sum, e) => sum + entryMinutes(e, now), 0);

/** "1 h 05 min", "45 min", "3 h". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")} min` : `${h} h`;
}
