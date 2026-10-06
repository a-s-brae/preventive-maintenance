import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { countPart, restockPart } from "@/lib/actions";
import { formatDateTime } from "@/lib/downtime";
import { formatMoney, formatQty, STOCK_REASON_LABEL, stockStatus } from "@/lib/parts";
import { can } from "@/lib/permissions";
import { userLabel } from "@/lib/queries";
import { woNumber } from "@/lib/work-orders";
import { CountForm, RestockForm } from "@/components/part-forms";
import { ButtonLink, Card, Empty, StockBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PartPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("view");
  const { id } = await params;
  const part = await db.part.findUnique({
    where: { id },
    include: { transactions: { orderBy: { createdAt: "desc" }, take: 100, include: { user: true } } },
  });
  if (!part) notFound();
  const woIds = [...new Set(part.transactions.map((t) => t.workOrderId).filter((x): x is string => !!x))];
  const wos = new Map((await db.workOrder.findMany({ where: { id: { in: woIds } }, select: { id: true, number: true, title: true } })).map((w) => [w.id, w]));
  const status = stockStatus(part);
  const details: [string, string | null][] = [
    ["Part number", part.partNumber],
    ["Stored at", part.storageLocation],
    ["Vendor", part.vendor],
    ["Unit cost", formatMoney(part.unitCost)],
    ["Low-stock level", part.minQuantity == null ? null : `${formatQty(part.minQuantity)} ${part.unit}`],
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-sm text-slate-500">
            <Link href="/parts" className="hover:underline">
              Parts
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{part.name}</h1>
          {part.description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{part.description}</p>}
        </div>
        {can(me.role, "manage") && (
          <ButtonLink href={`/parts/${part.id}/edit`} variant="secondary">
            Edit
          </ButtonLink>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Stock">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="text-3xl font-semibold tabular-nums">
                {formatQty(part.quantity)} <span className="text-lg font-normal text-slate-500">{part.unit} on hand</span>
              </div>
              {part.active ? <StockBadge status={status} /> : <span className="text-xs text-slate-500">retired</span>}
            </div>
            {can(me.role, "work") && (
              <div className="space-y-4">
                <RestockForm action={restockPart.bind(null, part.id)} unit={part.unit} unitCost={part.unitCost} />
                <CountForm action={countPart.bind(null, part.id)} unit={part.unit} />
              </div>
            )}
          </Card>
          <Card title="History">
            {part.transactions.length === 0 ? (
              <Empty>No stock changes yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>What</th>
                      <th>Change</th>
                      <th>After</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {part.transactions.map((t) => {
                      const wo = t.workOrderId ? wos.get(t.workOrderId) : null;
                      return (
                        <tr key={t.id}>
                          <td className="whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                          <td>
                            {STOCK_REASON_LABEL[t.reason]}
                            {wo && (
                              <>
                                {" on "}
                                <Link href={`/work-orders/${wo.id}`} className="link">
                                  {woNumber(wo.number)}
                                </Link>
                              </>
                            )}
                            {t.note && <div className="text-xs text-slate-500">{t.note}</div>}
                          </td>
                          <td className={`tabular-nums ${t.change < 0 ? "text-red-700" : "text-emerald-700"}`}>
                            {t.change > 0 ? "+" : ""}
                            {formatQty(t.change)}
                          </td>
                          <td className="tabular-nums">{formatQty(t.quantityAfter)}</td>
                          <td className="text-slate-600">{userLabel(t.user)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
        <Card title="Details">
          <dl className="space-y-2 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right">{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
          {part.notes && <p className="mt-4 text-sm whitespace-pre-wrap text-slate-700">{part.notes}</p>}
        </Card>
      </div>
    </>
  );
}
