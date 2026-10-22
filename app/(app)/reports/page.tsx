import { requirePermission } from "@/auth";
import Link from "next/link";
import { formatMinutes } from "@/lib/labor";
import { formatMoney } from "@/lib/parts";
import { laborRate, loadReport } from "@/lib/report-data";
import { formatHours, parseRange, RANGE_PRESETS, TYPE_ORDER } from "@/lib/reports";
import { TYPE_LABEL } from "@/lib/work-orders";
import { BarList, Legend, type Series } from "@/components/charts";
import { StackedColumns } from "@/components/dash-charts";
import { Card, PageHeader, StatTile } from "@/components/ui";
import { MoreMenu } from "@/components/more-menu";

export const dynamic = "force-dynamic";

type Params = { range?: string; from?: string; to?: string; rate?: string };

// Series colours in the validated order (chart-1, -2, -3); one series is always chart-1.
const TYPE_SERIES: Series[] = [
  { key: "PM", label: TYPE_LABEL.PM, color: "var(--color-chart-1)" },
  { key: "INSPECTION", label: TYPE_LABEL.INSPECTION, color: "var(--color-chart-2)" },
  { key: "REPAIR", label: TYPE_LABEL.REPAIR, color: "var(--color-chart-3)" },
];
const COMPLIANCE_SERIES: Series[] = [{ key: "pct", label: "Done on time", color: "var(--color-chart-1)" }];
const DOWNTIME_SERIES: Series[] = [{ key: "hours", label: "Hours down", color: "var(--color-chart-1)" }];
const COST_SERIES: Series[] = [
  { key: "parts", label: "Parts", color: "var(--color-chart-1)" },
  { key: "labor", label: "Labor", color: "var(--color-chart-2)" },
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
              <Link key={p.key} href={keep({ range: p.key })} aria-pressed={active} className="chip">
                {p.label}
              </Link>
            );
          })}
        </div>
        <form action="/reports" className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="range" value="custom" />
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-neutral-500">From</span>
            <input type="date" name="from" defaultValue={range.fromInput} required className="input w-auto py-1" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-neutral-500">To</span>
            <input type="date" name="to" defaultValue={range.toInput} required className="input w-auto py-1" />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-xs text-neutral-500">Labor $/h</span>
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
      <p className="-mt-3 mb-5 text-sm text-neutral-500">
        {range.preset === "custom" ? "" : `${range.label} · `}
        {range.fromInput} to {range.toInput}
      </p>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-4 @xl:grid-cols-3 @3xl:gap-6 @7xl:grid-cols-6">
        <StatTile
          label="PM compliance"
          value={r.compliance.percent == null ? "—" : `${r.compliance.percent}%`}
          detail={r.compliance.due ? `${r.compliance.onTime} of ${r.compliance.due} on time` : "No PMs due"}
          alert={r.compliance.percent != null && r.compliance.percent < 70}
          help="PM work orders due in this range that were done by their due date. Open ones past due count as missed."
        />
        <StatTile tone="blue" label="Work orders done" value={r.completedCount} detail={`${r.createdCount} created`} />
        <StatTile
          label="Open now"
          value={r.openCount}
          detail={r.overdueCount ? `${r.overdueCount} overdue` : "none overdue"}
          alert={r.overdueCount > 0}
          href={r.overdueCount ? "/work-orders?due=overdue" : "/work-orders"}
        />
        <StatTile
          tone="blue"
          label="Downtime"
          value={formatHours(r.reliability.downHours || 0)}
          detail={`${r.reliability.failures} ${r.reliability.failures === 1 ? "breakdown" : "breakdowns"}`}
          help="Time equipment was marked down. A breakdown is each time an asset was marked down."
        />
        <StatTile
          label="MTTR / MTBF"
          value={formatHours(r.reliability.mttrHours)}
          detail={`MTBF ${formatHours(r.reliability.mtbfHours)}`}
          help="Mean time to repair: how long a breakdown lasts on average. Mean time between failures: running time per breakdown, per asset (calendar hours)."
        />
        <StatTile
          tone="blue"
          label="Maintenance cost"
          value={formatMoney(r.totalCost)}
          detail={`${formatMoney(r.partsCost)} parts · ${formatMinutes(r.laborMinutes)} labor`}
          help={r.rate == null ? "Parts only. Enter a labor rate to include labor." : `Parts plus labor at ${formatMoney(r.rate)}/h.`}
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 @3xl:grid-cols-2">
        <Card title="Work orders completed" actions={<Legend series={pmTypes} />}>
          <StackedColumns
            series={pmTypes}
            columns={r.byBucket.map((b) => ({
              label: b.label,
              title: `${b.label}: ${b.total} done`,
              values: b.counts,
              display: b.total ? String(b.total) : null,
            }))}
            emptyText="No work orders completed in this range."
          />
        </Card>
        <Card title="PM compliance over time">
          <StackedColumns
            series={COMPLIANCE_SERIES}
            max={100}
            suffix="%"
            columns={r.complianceTrend.map((b) => ({
              label: b.label,
              title: b.due ? `${b.label}: ${b.onTime} of ${b.due} on time` : `${b.label}: no PMs due`,
              values: { pct: b.percent },
              display: b.percent == null ? null : `${b.percent}%`,
            }))}
            emptyText="No PMs were due in this range."
          />
        </Card>
        <Card title="Downtime by asset">
          <BarList
            series={DOWNTIME_SERIES}
            rows={byDowntime.map((a) => ({
              label: a.asset.name,
              href: `/assets/${a.asset.id}?tab=downtime`,
              values: { hours: a.downHours },
              display: formatHours(a.downHours),
            }))}
            emptyText="No downtime in this range."
          />
        </Card>
        <Card title={r.rate == null ? "Parts cost by asset" : "Cost by asset"} actions={r.rate != null && <Legend series={COST_SERIES} />}>
          <BarList
            series={r.rate == null ? COST_SERIES.slice(0, 1) : COST_SERIES}
            rows={top(8).map((a) => ({
              label: a.asset.name,
              href: `/assets/${a.asset.id}`,
              values: { parts: a.partsCost, labor: a.laborCost },
              display: formatMoney(r.rate == null ? a.partsCost : a.totalCost),
              detail: r.rate == null ? undefined : `Parts ${formatMoney(a.partsCost)} · Labor ${formatMoney(a.laborCost)}`,
            }))}
            emptyText={r.rate == null ? "No parts used in this range. Add a labor rate to include labor." : "No parts or labor logged in this range."}
          />
        </Card>
      </div>

      {/* Per-asset table */}
      <div className="mt-6">
        <Card title="By asset">
          {r.perAsset.length === 0 ? (
            <p className="text-sm text-neutral-500">No maintenance activity in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table min-w-[56rem] tabular-nums">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th className="text-right">WOs done</th>
                    <th className="text-right">PM on time</th>
                    <th className="text-right">Breakdowns</th>
                    <th className="text-right">Downtime</th>
                    <th className="text-right">MTTR</th>
                    <th className="text-right">MTBF</th>
                    <th className="text-right">Labor</th>
                    <th className="text-right">Parts</th>
                    <th className="text-right">Total cost</th>
                  </tr>
                </thead>
                <tbody>
                  {r.perAsset.map((a) => (
                    <tr key={a.asset.id}>
                      <td>
                        <Link href={`/assets/${a.asset.id}`} className="link">
                          {a.asset.name}
                        </Link>
                        <div className="text-xs text-neutral-500">{[a.asset.assetTag, a.asset.location?.name].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="text-right">{a.completed}</td>
                      <td className="text-right">
                        {a.compliance.percent == null ? "—" : `${a.compliance.percent}%`}
                        {a.compliance.due > 0 && <div className="text-xs text-neutral-500">{`${a.compliance.onTime}/${a.compliance.due}`}</div>}
                      </td>
                      <td className="text-right">{a.failures}</td>
                      <td className="text-right">{a.downHours ? formatHours(a.downHours) : "—"}</td>
                      <td className="text-right">{formatHours(a.mttrHours)}</td>
                      <td className="text-right">{formatHours(a.mtbfHours)}</td>
                      <td className="text-right">{a.laborMinutes ? formatMinutes(a.laborMinutes) : "—"}</td>
                      <td className="text-right">{a.partsCost ? formatMoney(a.partsCost) : "—"}</td>
                      <td className="text-right font-medium">{a.totalCost ? formatMoney(a.totalCost) : "—"}</td>
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
