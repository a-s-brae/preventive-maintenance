import { notFound } from "next/navigation";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { formatValue, parseResults } from "@/lib/checklist";
import { formatDateTime, requestNumber } from "@/lib/downtime";
import { isImage } from "@/lib/files";
import { formatDate, formatNumber } from "@/lib/forms";
import { entryMinutes, formatMinutes, totalMinutes } from "@/lib/labor";
import { formatMoney, formatQty, partsCost } from "@/lib/parts";
import { userLabel } from "@/lib/queries";
import { pathLabel } from "@/lib/tree";
import { getLocationTree } from "@/lib/queries";
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, woNumber } from "@/lib/work-orders";
import { Fields, PrintHeader, Section } from "../../print-parts";

export const dynamic = "force-dynamic";

export default async function PrintWorkOrder({ params }: { params: Promise<{ id: string }> }) {
  // Checked here too: the layout's check isn't guaranteed to run for every render of this page.
  await requirePermission("view");
  const { id } = await params;
  const wo = await db.workOrder.findUnique({
    where: { id },
    include: {
      asset: true,
      pmTask: true,
      assignedTo: true,
      completedBy: true,
      request: { include: { requestedBy: true } },
      partUsages: { include: { part: true } },
      labor: { include: { user: true }, orderBy: { startedAt: "asc" } },
      attachments: { where: { mimeType: { startsWith: "image/" } }, orderBy: { createdAt: "asc" } },
      downtimes: true,
    },
  });
  if (!wo) notFound();
  const location = (await getLocationTree()).find((l) => l.id === wo.asset.locationId);
  const results = parseResults(wo.checklistResults);

  return (
    <>
      <PrintHeader title={`${woNumber(wo.number)} — ${wo.title}`} subtitle={`${TYPE_LABEL[wo.type]} · ${STATUS_LABEL[wo.status]}`} />
      <Section title="Work order">
        <Fields
          rows={[
            ["Asset", `${wo.asset.name}${wo.asset.assetTag ? ` (${wo.asset.assetTag})` : ""}`],
            ["Location", pathLabel(location) || "—"],
            ["Priority", PRIORITY_LABEL[wo.priority]],
            ["Assigned to", wo.assignedTo ? userLabel(wo.assignedTo) : "—"],
            ["Due", wo.dueDate ? formatDate(wo.dueDate) : wo.dueMeter != null ? `at ${formatNumber(wo.dueMeter)} ${wo.asset.meterUnit ?? ""}` : "—"],
            ["Created", formatDate(wo.createdAt)],
            ["Started", formatDate(wo.startedAt)],
            ["Completed", wo.completedAt ? `${formatDate(wo.completedAt)} by ${userLabel(wo.completedBy)}` : "—"],
            ["Meter reading", wo.meterReading != null ? `${formatNumber(wo.meterReading)} ${wo.asset.meterUnit ?? ""}` : "—"],
            ["From request", wo.request ? `${requestNumber(wo.request.number)}${wo.request.requestedBy ? ` by ${userLabel(wo.request.requestedBy)}` : ""}` : "—"],
          ]}
        />
      </Section>
      {(wo.description || wo.pmTask?.instructions) && (
        <Section title="Instructions">
          <p className="whitespace-pre-wrap">{wo.description ?? wo.pmTask?.instructions}</p>
        </Section>
      )}
      {results.length > 0 && (
        <Section title="Checklist">
          <table className="w-full">
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-neutral-200">
                  <td className="py-1 pr-4">
                    {r.label}
                    {r.note && <div className="text-xs text-neutral-600">Note: {r.note}</div>}
                  </td>
                  <td className={`py-1 text-right font-medium ${r.value === "FAIL" ? "text-red-700" : ""}`}>{formatValue(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
      <Section title="Notes">
        <p className="min-h-10 whitespace-pre-wrap">{wo.completionNotes ?? ""}</p>
      </Section>
      {wo.partUsages.length > 0 && (
        <Section title="Parts used">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="py-1">Part</th>
                <th className="py-1">Qty</th>
                <th className="py-1 text-right">Cost</th>
              </tr>
            </thead>
            <tbody>
              {wo.partUsages.map((u) => (
                <tr key={u.id} className="border-b border-neutral-200">
                  <td className="py-1">
                    {u.part.name}
                    {u.part.partNumber ? ` (${u.part.partNumber})` : ""}
                  </td>
                  <td className="py-1">
                    {formatQty(u.quantity)} {u.part.unit}
                  </td>
                  <td className="py-1 text-right">{u.unitCost == null ? "—" : formatMoney(u.quantity * u.unitCost)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={2} className="py-1 text-right font-medium">
                  Total
                </td>
                <td className="py-1 text-right font-medium">{formatMoney(partsCost(wo.partUsages))}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      )}
      {wo.labor.length > 0 && (
        <Section title={`Time — ${formatMinutes(totalMinutes(wo.labor))}`}>
          <ul>
            {wo.labor.map((e) => (
              <li key={e.id}>
                {formatMinutes(entryMinutes(e))} · {userLabel(e.user)} · {formatDate(e.startedAt)}
                {e.note ? ` · ${e.note}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {wo.downtimes.length > 0 && (
        <Section title="Downtime">
          <ul>
            {wo.downtimes.map((d) => (
              <li key={d.id}>
                Down {formatDateTime(d.startedAt)} → {d.endedAt ? formatDateTime(d.endedAt) : "still down"}
                {d.reason ? ` — ${d.reason}` : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {wo.attachments.length > 0 && (
        <Section title="Photos">
          <div className="grid grid-cols-3 gap-2">
            {wo.attachments.filter((a) => isImage(a.mimeType)).map((a) => (
              // eslint-disable-next-line @next/next/no-img-element -- auth-checked file route
              <img key={a.id} src={`/files/${a.id}`} alt={a.fileName} className="aspect-[4/3] w-full rounded border border-neutral-200 bg-neutral-50 object-contain" />
            ))}
          </div>
        </Section>
      )}
      <Section title="Sign-off">
        <div className="grid grid-cols-2 gap-10 pt-6">
          {["Performed by", "Reviewed by"].map((label) => (
            <div key={label}>
              <div className="h-8 border-b border-neutral-900" />
              <div className="mt-1 flex justify-between text-xs text-neutral-600">
                <span>{label}</span>
                <span>Date</span>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
