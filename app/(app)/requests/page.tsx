import Link from "next/link";
import type { RequestStatus } from "@prisma/client";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { formatDateTime, requestNumber } from "@/lib/downtime";
import { userLabel } from "@/lib/queries";
import { PRIORITY_LABEL, woNumber } from "@/lib/work-orders";
import { ButtonLink, Card, DownBadge, Empty, PageHeader, PriorityText, RequestStatusBadge, Tabs } from "@/components/ui";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "pending", label: "Waiting for review", status: "PENDING" },
  { key: "approved", label: "Approved", status: "APPROVED" },
  { key: "rejected", label: "Rejected", status: "REJECTED" },
  { key: "all", label: "All", status: null },
] as const;


export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requirePermission("report");
  // Requesters only see the problems they reported.
  const mine = can(user.role, "view") ? {} : { requestedById: user.id };
  const { view: rawView } = await searchParams;
  const view = VIEWS.find((v) => v.key === rawView) ?? (can(user.role, "view") ? VIEWS[0] : VIEWS[3]);
  const [requests, counts] = await Promise.all([
    db.request.findMany({
      where: { ...mine, ...(view.status ? { status: view.status } : {}) },
      orderBy: { createdAt: view.status === "PENDING" ? "asc" : "desc" },
      take: 200,
      include: { asset: true, location: true, requestedBy: true, workOrder: true },
    }),
    db.request.groupBy({ by: ["status"], where: mine, _count: true }),
  ]);
  const countOf = (s: RequestStatus | null) => (s ? (counts.find((c) => c.status === s)?._count ?? 0) : counts.reduce((n, c) => n + c._count, 0));

  return (
    <>
      <PageHeader title={can(user.role, "view") ? "Requests" : "My requests"}>
        <ButtonLink href="/requests/new">Report a problem</ButtonLink>
      </PageHeader>
      <Tabs
        label="Request views"
        active={view.key}
        tabs={VIEWS.map((v) => ({ key: v.key, label: v.label, href: v.key === "pending" ? "/requests" : `/requests?view=${v.key}`, count: countOf(v.status) }))}
      />
      <Card>
        {requests.length === 0 ? (
          <Empty>
            {view.key !== "pending"
              ? "No requests here."
              : can(user.role, "review")
                ? "Nothing waiting for review. When someone reports a problem, it shows up here to approve or turn down."
                : "Nothing waiting for review."}
          </Empty>
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
                      <div className="flex items-center gap-2 text-xs text-neutral-500">
                        {requestNumber(r.number)}
                        {r.assetDown && <DownBadge />}
                      </div>
                    </td>
                    <td className="text-neutral-600">{r.asset?.name ?? r.location?.name ?? "—"}</td>
                    <td className="whitespace-nowrap text-neutral-600">
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
