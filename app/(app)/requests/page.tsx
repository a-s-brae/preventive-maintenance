import Link from "next/link";
import type { RequestStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDateTime, requestNumber } from "@/lib/downtime";
import { userLabel } from "@/lib/queries";
import { PRIORITY_LABEL, woNumber } from "@/lib/work-orders";
import { ButtonLink, Card, DownBadge, Empty, PageHeader, PriorityText, RequestStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "pending", label: "Waiting for review", status: "PENDING" },
  { key: "approved", label: "Approved", status: "APPROVED" },
  { key: "rejected", label: "Rejected", status: "REJECTED" },
  { key: "all", label: "All", status: null },
] as const;


export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view = VIEWS.find((v) => v.key === rawView) ?? VIEWS[0];
  const [requests, counts] = await Promise.all([
    db.request.findMany({
      where: view.status ? { status: view.status } : {},
      orderBy: { createdAt: view.status === "PENDING" ? "asc" : "desc" },
      take: 200,
      include: { asset: true, location: true, requestedBy: true, workOrder: true },
    }),
    db.request.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: RequestStatus | null) => (s ? (counts.find((c) => c.status === s)?._count ?? 0) : counts.reduce((n, c) => n + c._count, 0));

  return (
    <>
      <PageHeader title="Requests">
        <ButtonLink href="/requests/new">Report a problem</ButtonLink>
      </PageHeader>
      <nav className="mb-4 flex w-fit flex-wrap gap-1 rounded-lg bg-slate-200/60 p-1 text-sm">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={v.key === "pending" ? "/requests" : `/requests?view=${v.key}`}
            className={`rounded-md px-3 py-1.5 ${view.key === v.key ? "bg-white font-medium shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
          >
            {v.label} <span className="text-xs text-slate-500">{countOf(v.status)}</span>
          </Link>
        ))}
      </nav>
      <Card>
        {requests.length === 0 ? (
          <Empty>{view.key === "pending" ? "Nothing waiting for review." : "No requests here."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Equipment / place</th>
                  <th>Reported</th>
                  <th>Urgency</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/requests/${r.id}`} className="link">
                        {r.title}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        {requestNumber(r.number)}
                        {r.assetDown && <DownBadge />}
                      </div>
                    </td>
                    <td className="text-slate-600">{r.asset?.name ?? r.location?.name ?? "—"}</td>
                    <td className="whitespace-nowrap text-slate-600">
                      {formatDateTime(r.createdAt)}
                      <div className="text-xs">{r.requestedBy ? userLabel(r.requestedBy) : ""}</div>
                    </td>
                    <td title={PRIORITY_LABEL[r.priority]}>
                      <PriorityText priority={r.priority} />
                    </td>
                    <td className="whitespace-nowrap">
                      <RequestStatusBadge status={r.status} />
                      {r.workOrder && (
                        <Link href={`/work-orders/${r.workOrder.id}`} className="link ml-2 text-xs">
                          {woNumber(r.workOrder.number)}
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
