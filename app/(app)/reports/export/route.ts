import type { NextRequest } from "next/server";
import { requirePermission } from "@/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { laborRate, loadReport } from "@/lib/report-data";
import { parseRange } from "@/lib/reports";

export const dynamic = "force-dynamic";

const hours = (h: number | null) => (h == null ? "" : Math.round(h * 10) / 10);

/** The report's per-asset table as a spreadsheet. */
export async function GET(req: NextRequest) {
  await requirePermission("view");
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const range = parseRange(q);
  const r = await loadReport(range, laborRate(q.rate));
  const body = toCsv(
    [
      "Asset",
      "Asset tag",
      "Location",
      "Work orders done",
      "PMs due",
      "PMs on time",
      "PM compliance %",
      "Breakdowns",
      "Downtime (h)",
      "MTTR (h)",
      "MTBF (h)",
      "Labor (h)",
      "Parts cost",
      "Labor cost",
      "Total cost",
    ],
    r.perAsset.map((a) => [
      a.asset.name,
      a.asset.assetTag,
      a.asset.location?.name,
      a.completed,
      a.compliance.due,
      a.compliance.onTime,
      a.compliance.percent,
      a.failures,
      hours(a.downHours),
      hours(a.mttrHours),
      hours(a.mtbfHours),
      hours(a.laborMinutes / 60),
      a.partsCost,
      r.rate == null ? "" : a.laborCost,
      a.totalCost,
    ]),
  );
  return csvResponse(`maintenance-report-${range.fromInput}-to-${range.toInput}.csv`, body);
}
