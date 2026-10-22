// Maintenance KPIs for the reports page. Everything here is pure: the page
// loads the rows for the range and these functions do the counting.
//
//   PM compliance  PM work orders due in the range that were done by their due
//                  date. Open ones already past due count as missed; ones not
//                  due yet are left out. Usage-only PMs (no due date) count when
//                  completed in the range: on time if done by the due meter.
//   Failure        the asset was marked down (a downtime record).
//   MTTR           mean time to repair: average length of downtimes that ended
//                  in the range.
//   MTBF           mean time between failures: asset uptime in the range
//                  (calendar hours, not shift hours) divided by failures.
import type { WorkOrderType } from "@prisma/client";

const DAY = 86_400_000;
const HOUR = 3_600_000;

export const RANGE_PRESETS = [
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "365", label: "Last 12 months" },
  { key: "ytd", label: "This year" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["key"] | "custom";

export interface ReportRange {
  /** Start of the first day (UTC midnight), inclusive. */
  from: Date;
  /** Start of the day after the last day, exclusive. */
  to: Date;
  preset: RangePreset;
  label: string;
  /** YYYY-MM-DD of the first and last day, for date inputs and file names. */
  fromInput: string;
  toInput: string;
}

const startOfDay = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const ymd = (d: Date) => d.toISOString().slice(0, 10);
function parseYmd(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The range from the page's search params. Defaults to the last 90 days. */
export function parseRange(params: { range?: string; from?: string; to?: string }, now: Date = new Date()): ReportRange {
  const today = startOfDay(now);
  const tomorrow = new Date(today.getTime() + DAY);
  const make = (from: Date, to: Date, preset: RangePreset, label: string): ReportRange => ({
    from,
    to,
    preset,
    label,
    fromInput: ymd(from),
    toInput: ymd(new Date(to.getTime() - DAY)),
  });

  const from = parseYmd(params.from);
  const to = parseYmd(params.to);
  if (params.range === "custom" && from && to) {
    const [a, b] = from <= to ? [from, to] : [to, from];
    return make(a, new Date(b.getTime() + DAY), "custom", `${ymd(a)} to ${ymd(b)}`);
  }
  if (params.range === "ytd") return make(new Date(Date.UTC(today.getUTCFullYear(), 0, 1)), tomorrow, "ytd", "This year");
  const preset = RANGE_PRESETS.find((p) => p.key === params.range && p.key !== "ytd") ?? RANGE_PRESETS[1];
  return make(new Date(tomorrow.getTime() - Number(preset.key) * DAY), tomorrow, preset.key, preset.label);
}

const inRange = (d: Date | null | undefined, r: Pick<ReportRange, "from" | "to">) => !!d && d >= r.from && d < r.to;

// ─── PM compliance ───────────────────────────────────────────────────────────

export interface PmWorkOrder {
  assetId: string;
  status: string;
  dueDate: Date | null;
  dueMeter: number | null;
  completedAt: Date | null;
  meterReading: number | null;
}

export interface Compliance {
  /** PM work orders counted. */
  due: number;
  onTime: number;
  late: number;
  /** Still open and past due. */
  missed: number;
  /** 0–100, or null with nothing due. */
  percent: number | null;
}

type Outcome = "ON_TIME" | "LATE" | "MISSED" | null;

/** How one PM work order counts towards compliance in the range (null = not counted). */
export function pmOutcome(wo: PmWorkOrder, range: Pick<ReportRange, "from" | "to">, now: Date): Outcome {
  const done = wo.status === "COMPLETE" && wo.completedAt != null;
  if (wo.dueDate) {
    if (!inRange(wo.dueDate, range)) return null;
    if (done) return ymd(wo.completedAt!) <= ymd(wo.dueDate) ? "ON_TIME" : "LATE";
    return ymd(wo.dueDate) < ymd(now) ? "MISSED" : null;
  }
  if (!done || !inRange(wo.completedAt, range)) return null;
  return wo.dueMeter == null || wo.meterReading == null || wo.meterReading <= wo.dueMeter ? "ON_TIME" : "LATE";
}

export function pmCompliance(wos: PmWorkOrder[], range: Pick<ReportRange, "from" | "to">, now: Date): Compliance {
  const c = { due: 0, onTime: 0, late: 0, missed: 0 };
  for (const wo of wos) {
    const o = pmOutcome(wo, range, now);
    if (o === "ON_TIME") c.onTime++;
    else if (o === "LATE") c.late++;
    else if (o === "MISSED") c.missed++;
    else continue;
    c.due++;
  }
  return { ...c, percent: c.due ? Math.round((c.onTime / c.due) * 100) : null };
}

// ─── Downtime: failures, MTTR, MTBF ──────────────────────────────────────────

export interface DowntimeRow {
  assetId: string;
  startedAt: Date;
  endedAt: Date | null;
}

export interface Reliability {
  failures: number;
  /** Hours down within the range (an open downtime counts up to now). */
  downHours: number;
  /** Mean time to repair in hours, from downtimes that ended in the range. */
  mttrHours: number | null;
  /** Mean time between failures in hours. */
  mtbfHours: number | null;
}

/** Hours of the range that have actually happened (the range may end in the future). */
export function elapsedHours(range: Pick<ReportRange, "from" | "to">, now: Date): number {
  const end = Math.min(range.to.getTime(), now.getTime());
  return Math.max(0, (end - range.from.getTime()) / HOUR);
}

/** Reliability for a set of downtimes over `assetCount` assets. */
export function reliability(downtimes: DowntimeRow[], range: Pick<ReportRange, "from" | "to">, now: Date, assetCount: number): Reliability {
  const end = Math.min(range.to.getTime(), now.getTime());
  let failures = 0;
  let downMs = 0;
  let repairMs = 0;
  let repairs = 0;
  for (const d of downtimes) {
    if (inRange(d.startedAt, range)) failures++;
    const stop = d.endedAt?.getTime() ?? now.getTime();
    downMs += Math.max(0, Math.min(stop, end) - Math.max(d.startedAt.getTime(), range.from.getTime()));
    if (d.endedAt && inRange(d.endedAt, range)) {
      repairs++;
      repairMs += d.endedAt.getTime() - d.startedAt.getTime();
    }
  }
  const downHours = downMs / HOUR;
  const uptime = Math.max(0, assetCount * elapsedHours(range, now) - downHours);
  return {
    failures,
    downHours,
    mttrHours: repairs ? repairMs / repairs / HOUR : null,
    mtbfHours: failures ? uptime / failures : null,
  };
}

// ─── Charts: work orders over time ───────────────────────────────────────────

export interface Bucket {
  start: Date;
  end: Date;
  label: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Weeks (Monday start) for ranges up to ~3 months, months beyond that. */
export function buckets(range: Pick<ReportRange, "from" | "to">): Bucket[] {
  const days = (range.to.getTime() - range.from.getTime()) / DAY;
  const out: Bucket[] = [];
  if (days <= 92) {
    const first = new Date(range.from.getTime() - ((range.from.getUTCDay() + 6) % 7) * DAY);
    for (let s = first; s < range.to; s = new Date(s.getTime() + 7 * DAY)) {
      out.push({ start: s, end: new Date(s.getTime() + 7 * DAY), label: `${MONTHS[s.getUTCMonth()]} ${s.getUTCDate()}` });
    }
  } else {
    let s = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), 1));
    while (s < range.to) {
      const e = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 1));
      const label = s.getUTCMonth() === 0 || out.length === 0 ? `${MONTHS[s.getUTCMonth()]} ${String(s.getUTCFullYear()).slice(2)}` : MONTHS[s.getUTCMonth()];
      out.push({ start: s, end: e, label });
      s = e;
    }
  }
  return out;
}

export const TYPE_ORDER: WorkOrderType[] = ["PM", "INSPECTION", "REPAIR"];

/** Completed work orders per bucket, split by type. */
export function completedByBucket(wos: { type: WorkOrderType; completedAt: Date | null }[], bs: Bucket[]) {
  return bs.map((b) => {
    const counts = { PM: 0, INSPECTION: 0, REPAIR: 0 } as Record<WorkOrderType, number>;
    for (const wo of wos) if (inRange(wo.completedAt, { from: b.start, to: b.end })) counts[wo.type]++;
    return { ...b, counts, total: counts.PM + counts.INSPECTION + counts.REPAIR };
  });
}

/** PM compliance per bucket, for the trend chart. */
export function complianceByBucket(wos: PmWorkOrder[], bs: Bucket[], now: Date) {
  return bs.map((b) => ({ ...b, ...pmCompliance(wos, { from: b.start, to: b.end }, now) }));
}

/** "1.5 h", "36 h", "12 d"; "<0.1 h" for a little (never "0 h" for some); "—" for null. */
export function formatHours(h: number | null): string {
  if (h == null) return "—";
  if (h >= 72) return `${Math.round(h / 24)} d`;
  if (h >= 10) return `${Math.round(h)} h`;
  if (h > 0 && h < 0.05) return "<0.1 h";
  return `${Math.round(h * 10) / 10} h`;
}
