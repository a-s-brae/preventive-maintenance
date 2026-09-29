// Due-date logic for PM tasks. Pure functions — no database access — so the
// rules are easy to test and reuse.
//
// A task can be due by calendar, by usage (meter), or both. With both, the
// task is due at whichever limit is reached first.
//
// Calendar schedules come in two kinds:
//   COMPLETION — next due is one interval after it was last done
//   FIXED      — due on a fixed calendar: startDate, startDate + 1 interval, …
//                however early or late each one was done

export type IntervalUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";
export type ScheduleBasis = "COMPLETION" | "FIXED";
export type DueStatus = "OVERDUE" | "DUE_SOON" | "OK" | "NO_SCHEDULE";

export interface ScheduleInput {
  calendarEvery: number | null;
  calendarUnit: IntervalUnit | null;
  usageEvery: number | null;
  scheduleBasis: ScheduleBasis;
  /** First calendar due date. */
  startDate: Date;
  /** FIXED schedules: index of the next occurrence. */
  fixedCycle: number;
  startMeter: number | null;
  lastDoneAt: Date | null;
  lastDoneMeter: number | null;
  dueSoonDays: number;
}

export interface DueInfo {
  status: DueStatus;
  nextDueAt: Date | null;
  nextDueMeter: number | null;
  /** Whole days until the calendar due date (negative = overdue). */
  daysLeft: number | null;
  /** Meter units left before the usage limit (negative = overdue). */
  meterLeft: number | null;
}

/** Fraction of the usage interval remaining at which a task is "due soon". */
export const USAGE_DUE_SOON_FRACTION = 0.1;

const DAY_MS = 24 * 60 * 60 * 1000;

const APPROX_UNIT_DAYS: Record<IntervalUnit, number> = { DAY: 1, WEEK: 7, MONTH: 30, YEAR: 365 };

/** The due-soon window, capped at a quarter of the interval so a short task
 *  (e.g. weekly with a 7-day warning) isn't "due soon" the moment it's done. */
export function effectiveDueSoonDays(task: Pick<ScheduleInput, "calendarEvery" | "calendarUnit" | "dueSoonDays">): number {
  if (!task.calendarEvery || !task.calendarUnit) return task.dueSoonDays;
  const cap = Math.floor((task.calendarEvery * APPROX_UNIT_DAYS[task.calendarUnit]) / 4);
  return Math.min(task.dueSoonDays, cap);
}

/** Add an interval to a date, in UTC. Month/year steps clamp to the last day
 *  of the month (Jan 31 + 1 month = Feb 28/29). */
export function addInterval(date: Date, every: number, unit: IntervalUnit): Date {
  const d = new Date(date.getTime());
  switch (unit) {
    case "DAY":
      d.setUTCDate(d.getUTCDate() + every);
      return d;
    case "WEEK":
      d.setUTCDate(d.getUTCDate() + every * 7);
      return d;
    case "MONTH":
    case "YEAR": {
      const months = unit === "YEAR" ? every * 12 : every;
      const day = d.getUTCDate();
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + months);
      const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      d.setUTCDate(Math.min(day, lastDay));
      return d;
    }
  }
}

export function computeDue(task: ScheduleInput, currentMeter: number | null, now: Date = new Date()): DueInfo {
  let nextDueAt: Date | null = null;
  let daysLeft: number | null = null;
  if (task.calendarEvery && task.calendarUnit) {
    nextDueAt =
      task.scheduleBasis === "FIXED"
        ? fixedOccurrence(task.startDate, task.calendarEvery, task.calendarUnit, task.fixedCycle)
        : task.lastDoneAt
          ? addInterval(task.lastDoneAt, task.calendarEvery, task.calendarUnit)
          : task.startDate;
    daysLeft = daysUntil(nextDueAt, now);
  }

  let nextDueMeter: number | null = null;
  let meterLeft: number | null = null;
  if (task.usageEvery) {
    const base = task.lastDoneMeter ?? task.startMeter ?? 0;
    nextDueMeter = base + task.usageEvery;
    if (currentMeter != null) meterLeft = nextDueMeter - currentMeter;
  }

  if (nextDueAt == null && nextDueMeter == null) {
    return { status: "NO_SCHEDULE", nextDueAt, nextDueMeter, daysLeft, meterLeft };
  }

  const calendarOverdue = daysLeft != null && daysLeft < 0;
  const usageOverdue = meterLeft != null && meterLeft <= 0;
  const calendarSoon = daysLeft != null && daysLeft <= effectiveDueSoonDays(task);
  const usageSoon =
    meterLeft != null && task.usageEvery != null && meterLeft <= task.usageEvery * USAGE_DUE_SOON_FRACTION;

  const status: DueStatus =
    calendarOverdue || usageOverdue ? "OVERDUE" : calendarSoon || usageSoon ? "DUE_SOON" : "OK";
  return { status, nextDueAt, nextDueMeter, daysLeft, meterLeft };
}

/** Occurrence n of a fixed schedule (n = 0 is the start date). Counted from
 *  the start each time so month-end dates don't drift (Jan 31, Feb 28, Mar 31). */
export function fixedOccurrence(start: Date, every: number, unit: IntervalUnit, n: number): Date {
  return addInterval(start, every * n, unit);
}

/** FIXED schedules: the cycle to schedule next after occurrence `doneCycle` was
 *  done on `doneAt`. Occurrences already past by then are skipped — the work
 *  was just done, so there's no point having it due again in the past. */
export function nextFixedCycle(
  task: Pick<ScheduleInput, "startDate" | "calendarEvery" | "calendarUnit">,
  doneCycle: number,
  doneAt: Date,
): number {
  if (!task.calendarEvery || !task.calendarUnit) return doneCycle + 1;
  let n = doneCycle + 1;
  while (startOfUtcDay(fixedOccurrence(task.startDate, task.calendarEvery, task.calendarUnit, n)) <= startOfUtcDay(doneAt)) n++;
  return n;
}

/** Whole days from `now` until `date` (negative = past). */
export function daysUntil(date: Date, now: Date = new Date()): number {
  return Math.floor((startOfUtcDay(date) - startOfUtcDay(now)) / DAY_MS);
}

const STATUS_RANK: Record<DueStatus, number> = { OVERDUE: 0, DUE_SOON: 1, OK: 2, NO_SCHEDULE: 3 };

/** Sort most urgent first: status, then fewest days left. */
export function compareDue(a: DueInfo, b: DueInfo): number {
  const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (byStatus !== 0) return byStatus;
  return (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity);
}

export function describeInterval(
  task: Pick<ScheduleInput, "calendarEvery" | "calendarUnit" | "usageEvery"> & { scheduleBasis?: ScheduleBasis },
  meterUnit: string | null,
): string {
  const parts: string[] = [];
  if (task.calendarEvery && task.calendarUnit) {
    const unit = task.calendarUnit.toLowerCase();
    const fixed = task.scheduleBasis === "FIXED" ? " (fixed)" : "";
    parts.push((task.calendarEvery === 1 ? `every ${unit}` : `every ${task.calendarEvery} ${unit}s`) + fixed);
  }
  if (task.usageEvery) parts.push(`every ${task.usageEvery} ${meterUnit ?? "units"}`);
  return parts.length ? parts.join(" or ") : "no schedule";
}

function startOfUtcDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
