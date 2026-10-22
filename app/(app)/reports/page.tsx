import { requirePermission } from "@/auth";
import Link from "next/link";
import { formatMinutes } from "@/lib/labor";
import { formatMoney } from "@/lib/parts";
import { laborRate, loadReport } from "@/lib/report-data";
import { formatHours, parseRange, RANGE_PRESETS, TYPE_ORDER } from "@/lib/reports";
import { TYPE_LABEL } from "@/lib/work-orders";
import { BarList, ColumnChart, Legend, type Series } from "@/components/charts";
import { Card, PageHeader } from "@/components/ui";
import { MoreMenu } from "@/components/more-menu";

export const dynamic = "force-dynamic";

type Params = { range?: string; from?: string; to?: string; rate?: string };

const TYPE_SERIES: Series[] = [
  { key: "PM", label: TYPE_LABEL.PM, color: "bg-sky-600" },
  { key: "INSPECTION", label: TYPE_LABEL.INSPECTION, color: "bg-violet-500" },
  { key: "REPAIR", label: TYPE_LABEL.REPAIR, color: "bg-amber-500" },
];
const COMPLIANCE_SERIES: Series[] = [{ key: "pct", label: "Done on time", color: "bg-emerald-600" }];
const DOWNTIME_SERIES: Series[] = [{ key: "hours", label: "Hours down", color: "bg-red-500" }];
const COST_SERIES: Series[] = [
  { key: "parts", label: "Parts", color: "bg-sky-600" },
  { key: "labor", label: "Labor", color: "bg-amber-500" },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requirePermission("view");
  const params = await searchParams;
  const range = parseRange(params);
  const rate = laborRate(params.rate);
  const r = await loadReport(range, rate);

  const keep = (extra: Record<string, string>) => {
    const q = new URLSearchParams(extra);
    if (params.rate) q.set("rate", params.rate);
    return `/reports?${q}`;
  };
  const exportHref = `/reports/export?${new URLSearchParams({ range: range.preset, from: range.fromInput, to: range.toInput, ...(params.rate && { rate: params.rate }) })}`;
  const top = (n: number) => r.perAsset.slice(0, n);
  const byDowntime = [...r.perAsset].sort((a, b) => b.downHours - a.downHours).slice(0, 8);
  const pmTypes = TYPE_ORDER.map((t) => TYPE_SERIES.find((s) => s.key === t)!);

  return (
    <>
      <PageHeader title="Reports">
        <MoreMenu items={[{ label: "Export to Excel (CSV)", href: exportHref, download: true }]} />
      </PageHeader>

      {/* Date range */}
      <div className="mb-6 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Date range">
          {RANGE_PRESETS.map((p) => {
            const active = range.preset === p.key;
            return (
              <Link
                key={p.key}
                href={keep({ range: p.key })}
                aria-pressed={active}
                className={`rounded-full px-3 py-1 text-sm ring-1 ring-inset ${
                  active ? "bg-sky-700 text-white ring-sky-700" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
        <form action="/reports" className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="range" value="custom" />
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">From</span>
            <input type="date" name="from" defaultValue={range.fromInput} required className="input w-auto py-1" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">To</span>
            <input type="date" name="to" defaultValue={range.toInput} required className="input w-auto py-1" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-slate-500">Labor $/h</span>
            <input
              type="number"
              name="rate"
              min={0}
              step="any"
              defaultValue={params.rate ?? rate ?? ""}
              placeholder="none"
              className="input w-24 py-1"
            />
          </label>
          <button type="submit" className="btn-secondary py-1">
            Apply
          </button>
        </form>
      </div>
      <p className="-mt-3 mb-5 text-sm text-slate-500">
        {range.preset === "custom" ? "" : `${range.label} · `}
        {range.fromInput} to {range.toInput}
      </p>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="PM compliance"
          value={r.compliance.percent == null ? "—" : `${r.compliance.percent}%`}
          detail={r.compliance.due ? `${r.compliance.onTime} of ${r.compliance.due} on time` : "No PMs due"}
          tone={r.compliance.percent == null ? undefined : r.compliance.percent >= 90 ? "good" : r.compliance.percent >= 70 ? "warn" : "bad"}
          help="PM work orders due in this range that were done by their due date. Open ones past due count as missed."
        />
        <Kpi label="Work orders done" value={String(r.completedCount)} detail={`${r.createdCount} created`} />
        <Kpi
          label="Open now"
          value={String(r.openCount)}
          detail={r.overdueCount ? `${r.overdueCount} overdue` : "none overdue"}
          tone={r.overdueCount ? "bad" : undefined}
        />
        <Kpi
          label="Downtime"
          value={formatHours(r.reliability.downHours || 0)}
          detail={`${r.reliability.failures} ${r.reliability.failures === 1 ? "breakdown" : "breakdowns"}`}
          help="Time equipment was marked down. A breakdown is each time an asset was marked down."
        />
        <Kpi
          label="MTTR / MTBF"
          value={formatHours(r.reliability.mttrHours)}
          detail={`MTBF ${formatHours(r.reliability.mtbfHours)}`}
          help="Mean time to repair: how long a breakdown lasts on average. Mean time between failures: running time per breakdown, per asset (calendar hours)."
        />
        <Kpi
          label="Maintenance cost"
          value={formatMoney(r.totalCost)}
          detail={`${formatMoney(r.partsCost)} parts · ${formatMinutes(r.laborMinutes)} labor`}
          help={r.rate == null ? "Parts only. Enter a labor rate to include labor." : `Parts plus labor at ${formatMoney(r.rate)}/h.`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Work orders completed">
          <Legend series={pmTypes} />
          <ColumnChart
            series={pmTypes}
            columns={r.byBucket.map((b) => ({
              label: b.label,
              values: b.counts,
              title: `${b.label}: ${b.total} done — ${pmTypes.map((s) => `${s.label} ${b.counts[s.key as keyof typeof b.counts]}`).join(", ")}`,
            }))}
            emptyText="No work orders completed in this range."
          />
        </Card>
        <Card title="PM compliance over time">
          <Legend series={COMPLIANCE_SERIES} />
          <ColumnChart
            series={COMPLIANCE_SERIES}
            max={100}
            showZero
            format={(v) => `${Math.round(v)}%`}
            columns={r.complianceTrend.map((b) => ({
              label: b.label,
              values: { pct: b.percent },
              title: b.due ? `${b.label}: ${b.onTime} of ${b.due} on time (${b.percent}%)` : `${b.label}: no PMs due`,
            }))}
            emptyText="No PMs were due in this range."
          />
        </Card>
        <Card title="Downtime by asset">
          <BarList
            series={DOWNTIME_SERIES}
            format={(v) => formatHours(v)}
            rows={byDowntime.map((a) => ({ label: a.asset.name, href: `/assets/${a.asset.id}?tab=downtime`, values: { hours: a.downHours } }))}
            emptyText="No downtime in this range."
          />
        </Card>
        <Card title={r.rate == null ? "Parts cost by asset" : "Cost by asset"}>
          {r.rate != null && <Legend series={COST_SERIES} />}
          <BarList
            series={r.rate == null ? COST_SERIES.slice(0, 1) : COST_SERIES}
            format={(v) => formatMoney(v)}
            rows={top(8).map((a) => ({ label: a.asset.name, href: `/assets/${a.asset.id}`, values: { parts: a.partsCost, labor: a.laborCost } }))}
            emptyText={r.rate == null ? "No parts used in this range. Add a labor rate to include labor." : "No parts or labor logged in this range."}
          />
        </Card>
      </div>

      {/* Per-asset table */}
      <div className="mt-6">
        <Card title="By asset">
          {r.perAsset.length === 0 ? (
            <p className="text-sm text-slate-500">No maintenance activity in this range.</p>
          ) : (
            <div className="-mx-4 overflow-x-auto">
              <table className="w-full min-w-[56rem] text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-2 font-medium">Asset</th>
                    <th className="px-3 py-2 text-right font-medium">WOs done</th>
                    <th className="px-3 py-2 text-right font-medium">PM on time</th>
                    <th className="px-3 py-2 text-right font-medium">Breakdowns</th>
                    <th className="px-3 py-2 text-right font-medium">Downtime</th>
                    <th className="px-3 py-2 text-right font-medium">MTTR</th>
                    <th className="px-3 py-2 text-right font-medium">MTBF</th>
                    <th className="px-3 py-2 text-right font-medium">Labor</th>
                    <th className="px-3 py-2 text-right font-medium">Parts</th>
                    <th className="px-4 py-2 text-right font-medium">Total cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {r.perAsset.map((a) => (
                    <tr key={a.asset.id}>
                      <td className="px-4 py-2">
                        <Link href={`/assets/${a.asset.id}`} className="link">
                          {a.asset.name}
                        </Link>
                        <div className="text-xs text-slate-500">{[a.asset.assetTag, a.asset.location?.name].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{a.completed}</td>
                      <td className="px-3 py-2 text-right">
                        {a.compliance.percent == null ? "—" : `${a.compliance.percent}%`}
                        {a.compliance.due > 0 && <div className="text-xs text-slate-500">{`${a.compliance.onTime}/${a.compliance.due}`}</div>}
                      </td>
                      <td className="px-3 py-2 text-right">{a.failures}</td>
                      <td className="px-3 py-2 text-right">{a.downHours ? formatHours(a.downHours) : "—"}</td>
                      <td className="px-3 py-2 text-right">{formatHours(a.mttrHours)}</td>
                      <td className="px-3 py-2 text-right">{formatHours(a.mtbfHours)}</td>
                      <td className="px-3 py-2 text-right">{a.laborMinutes ? formatMinutes(a.laborMinutes) : "—"}</td>
                      <td className="px-3 py-2 text-right">{a.partsCost ? formatMoney(a.partsCost) : "—"}</td>
                      <td className="px-4 py-2 text-right font-medium">{a.totalCost ? formatMoney(a.totalCost) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function Kpi({ label, value, detail, tone, help }: { label: string; value: string; detail: string; tone?: "good" | "warn" | "bad"; help?: string }) {
  const color = tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-600" : tone === "bad" ? "text-red-700" : "text-slate-900";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm" title={help}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
      <div className="mt-0.5 text-xs leading-snug text-slate-500">{detail}</div>
    </div>
  );
}
