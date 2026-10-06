// Loads everything the reports page and its CSV export need for a range.
import { db } from "@/lib/db";
import { getAllOpenWorkOrders } from "@/lib/queries";
import { entryMinutes } from "@/lib/labor";
import { roundQty } from "@/lib/parts";
import { buckets, complianceByBucket, completedByBucket, pmCompliance, reliability, type ReportRange } from "@/lib/reports";

/** Hourly labor rate from the URL, else the LABOR_RATE setting, else none. */
export function laborRate(param: string | undefined): number | null {
  for (const raw of [param, process.env.LABOR_RATE]) {
    if (raw == null || raw.trim() === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return n || null;
  }
  return null;
}

export async function loadReport(range: ReportRange, rate: number | null, now: Date = new Date()) {
  const bs = buckets(range);
  // Weekly buckets can start a few days before the range.
  const from = bs[0] && bs[0].start < range.from ? bs[0].start : range.from;
  const window = { gte: from, lt: range.to };

  const [assets, pmWorkOrders, completed, createdCount, downtimes, partUsages, labor, open] = await Promise.all([
    db.asset.findMany({
      select: { id: true, name: true, assetTag: true, status: true, location: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.workOrder.findMany({
      where: { type: "PM", OR: [{ dueDate: window }, { dueDate: null, completedAt: window }] },
      select: { assetId: true, status: true, dueDate: true, dueMeter: true, completedAt: true, meterReading: true },
    }),
    db.workOrder.findMany({ where: { status: "COMPLETE", completedAt: window }, select: { assetId: true, type: true, completedAt: true } }),
    db.workOrder.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
    db.downtime.findMany({
      where: { startedAt: { lt: range.to }, OR: [{ endedAt: null }, { endedAt: { gte: range.from } }] },
      select: { assetId: true, startedAt: true, endedAt: true },
    }),
    db.partUsage.findMany({
      where: { createdAt: { gte: range.from, lt: range.to } },
      select: { quantity: true, unitCost: true, workOrder: { select: { assetId: true } } },
    }),
    db.laborEntry.findMany({
      where: { startedAt: { gte: range.from, lt: range.to } },
      select: { minutes: true, startedAt: true, endedAt: true, workOrder: { select: { assetId: true } } },
    }),
    getAllOpenWorkOrders(),
  ]);

  const inRange = <T extends { completedAt: Date | null }>(rows: T[]) =>
    rows.filter((r) => r.completedAt && r.completedAt >= range.from && r.completedAt < range.to);
  // Assets that existed for the range: everything not retired, plus retired ones that had downtime.
  const downAssets = new Set(downtimes.map((d) => d.assetId));
  const fleetSize = assets.filter((a) => a.status !== "RETIRED" || downAssets.has(a.id)).length;

  // Per-asset numbers, for the table and the bar charts.
  const perAsset = assets
    .map((a) => {
      const parts = partUsages.filter((u) => u.workOrder.assetId === a.id).reduce((s, u) => s + u.quantity * (u.unitCost ?? 0), 0);
      const laborMinutes = labor.filter((l) => l.workOrder.assetId === a.id).reduce((s, l) => s + entryMinutes(l, now), 0);
      const laborCost = rate != null ? (laborMinutes / 60) * rate : 0;
      return {
        asset: a,
        completed: inRange(completed).filter((w) => w.assetId === a.id).length,
        compliance: pmCompliance(
          pmWorkOrders.filter((w) => w.assetId === a.id),
          range,
          now,
        ),
        ...reliability(
          downtimes.filter((d) => d.assetId === a.id),
          range,
          now,
          1,
        ),
        laborMinutes,
        partsCost: roundQty(parts),
        laborCost: roundQty(laborCost),
        totalCost: roundQty(parts + laborCost),
      };
    })
    .filter((r) => r.completed || r.compliance.due || r.failures || r.downHours || r.laborMinutes || r.partsCost)
    .sort((a, b) => b.totalCost - a.totalCost || b.downHours - a.downHours || b.completed - a.completed || a.asset.name.localeCompare(b.asset.name));

  const sum = (f: (r: (typeof perAsset)[number]) => number) => perAsset.reduce((s, r) => s + f(r), 0);
  const completedInRange = inRange(completed);

  return {
    range,
    rate,
    compliance: pmCompliance(pmWorkOrders, range, now),
    reliability: reliability(downtimes, range, now, fleetSize),
    completedCount: completedInRange.length,
    createdCount,
    openCount: open.length,
    overdueCount: open.filter((w) => w.due.status === "OVERDUE").length,
    laborMinutes: sum((r) => r.laborMinutes),
    partsCost: roundQty(sum((r) => r.partsCost)),
    laborCost: roundQty(sum((r) => r.laborCost)),
    totalCost: roundQty(sum((r) => r.totalCost)),
    byBucket: completedByBucket(completed, bs),
    complianceTrend: complianceByBucket(pmWorkOrders, bs, now),
    perAsset,
  };
}

export type Report = Awaited<ReturnType<typeof loadReport>>;
