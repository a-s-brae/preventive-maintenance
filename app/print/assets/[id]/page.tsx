import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { parseResults, summarize } from "@/lib/checklist";
import { downtimeHours, formatDateTime, formatDuration } from "@/lib/downtime";
import { formatDate, toDateInput } from "@/lib/forms";
import { formatMinutes, totalMinutes } from "@/lib/labor";
import { formatMoney, partsCost } from "@/lib/parts";
import { getLocationTree, userLabel } from "@/lib/queries";
import { describeInterval } from "@/lib/schedule";
import { pathLabel } from "@/lib/tree";
import { TYPE_LABEL, woNumber } from "@/lib/work-orders";
import { Fields, PrintHeader, Section } from "../../print-parts";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;
const parseDay = (s: string | undefined, fallback: Date) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : fallback);

/** An asset's maintenance history for a date range — for audits. */
export default async function PrintAssetHistory({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string; to?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const now = new Date();
  const to = parseDay(sp.to, now);
  const from = parseDay(sp.from, new Date(now.getTime() - 365 * DAY));
  const toEnd = new Date(to.getTime() + DAY); // include the whole "to" day
  const asset = await db.asset.findUnique({
    where: { id },
    include: {
      tasks: { where: { active: true }, orderBy: { title: "asc" } },
      workOrders: {
        where: { status: "COMPLETE", completedAt: { gte: from, lt: toEnd } },
        orderBy: { completedAt: "asc" },
        include: { completedBy: true, partUsages: true, labor: true },
      },
      downtimes: { where: { startedAt: { lt: toEnd }, OR: [{ endedAt: null }, { endedAt: { gte: from } }] }, orderBy: { startedAt: "asc" } },
    },
  });
  if (!asset) notFound();
  const location = (await getLocationTree()).find((l) => l.id === asset.locationId);
  const wos = asset.workOrders;

  return (
    <>
      <PrintHeader title={`${asset.name} — maintenance history`} subtitle={`${formatDate(from)} to ${formatDate(to)}`} />
      <form className="mb-5 flex flex-wrap items-end gap-2 text-sm print:hidden">
        <label>
          From <input type="date" name="from" defaultValue={toDateInput(from)} className="input w-auto" />
        </label>
        <label>
          To <input type="date" name="to" defaultValue={toDateInput(to)} className="input w-auto" />
        </label>
        <button className="btn-secondary">Update</button>
      </form>
      <Section title="Asset">
        <Fields
          rows={[
            ["Asset tag", asset.assetTag ?? "—"],
            ["Location", pathLabel(location) || "—"],
            ["Manufacturer / model", [asset.manufacturer, asset.model].filter(Boolean).join(" ") || "—"],
            ["Serial number", asset.serialNumber ?? "—"],
            ["Work orders done", String(wos.length)],
            ["PM / repair / inspection", `${wos.filter((w) => w.type === "PM").length} / ${wos.filter((w) => w.type === "REPAIR").length} / ${wos.filter((w) => w.type === "INSPECTION").length}`],
            ["Time logged", formatMinutes(wos.reduce((m, w) => m + totalMinutes(w.labor), 0))],
            ["Parts cost", formatMoney(wos.reduce((c, w) => c + partsCost(w.partUsages), 0))],
            ["Downtime", formatDuration(downtimeHours(asset.downtimes, from, toEnd, now))],
          ]}
        />
      </Section>
      {asset.tasks.length > 0 && (
        <Section title="PM schedules">
          <ul>
            {asset.tasks.map((t) => (
              <li key={t.id}>
                {t.title} — {describeInterval(t, asset.meterUnit)}; last done {formatDate(t.lastDoneAt)}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Work done">
        {wos.length === 0 ? (
          <p className="text-slate-500">No completed work orders in this period.</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1">Date</th>
                <th className="py-1">Work order</th>
                <th className="py-1">By</th>
                <th className="py-1">Checklist</th>
                <th className="py-1">Notes</th>
              </tr>
            </thead>
            <tbody>
              {wos.map((w) => {
                const s = summarize(parseResults(w.checklistResults));
                return (
                  <tr key={w.id} className="border-b border-slate-200 align-top">
                    <td className="py-1 pr-2 whitespace-nowrap">{formatDate(w.completedAt)}</td>
                    <td className="py-1 pr-2">
                      {woNumber(w.number)} · {TYPE_LABEL[w.type]}
                      <div>{w.title}</div>
                    </td>
                    <td className="py-1 pr-2">{userLabel(w.completedBy)}</td>
                    <td className="py-1 pr-2 whitespace-nowrap">
                      {s.total ? `${s.answered}/${s.total}` : "—"}
                      {s.failed ? <span className="font-medium text-red-700"> · {s.failed} failed</span> : null}
                    </td>
                    <td className="py-1 whitespace-pre-wrap">{w.completionNotes ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>
      {asset.downtimes.length > 0 && (
        <Section title="Downtime">
          <ul>
            {asset.downtimes.map((d) => (
              <li key={d.id}>
                {formatDateTime(d.startedAt)} → {d.endedAt ? formatDateTime(d.endedAt) : "still down"}
                {d.reason ? ` — ${d.reason}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}
