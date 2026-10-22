import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { approveRequest, rejectRequest } from "@/lib/actions";
import { formatDateTime, requestNumber } from "@/lib/downtime";
import { getAssetTree, getLocationTree, getUsers, userLabel } from "@/lib/queries";
import { pathLabel } from "@/lib/tree";
import { PRIORITY_LABEL, STATUS_LABEL, woNumber } from "@/lib/work-orders";
import { ApproveForm, RejectForm } from "@/components/request-forms";
import { Card, DownBadge, RequestStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const user = await requirePermission("report");
  const [{ id }, { submitted }] = await Promise.all([params, searchParams]);
  const r = await db.request.findUnique({
    where: { id },
    include: { asset: true, location: true, requestedBy: true, reviewedBy: true, workOrder: true, downtimes: { orderBy: { startedAt: "desc" } } },
  });
  // Requesters can only open their own requests.
  if (!r || (!can(user.role, "view") && r.requestedById !== user.id)) notFound();
  const pending = r.status === "PENDING" && can(user.role, "review");
  const [assets, users, locations] = pending ? await Promise.all([getAssetTree(), getUsers(), getLocationTree()]) : [[], [], await getLocationTree()];
  const where = r.location ? pathLabel(locations.find((l) => l.id === r.location!.id)) : null;

  const details: [string, React.ReactNode][] = [
    ["Equipment", r.asset ? (can(user.role, "view") ? <Link key="a" href={`/assets/${r.asset.id}`} className="link">{r.asset.name}</Link> : r.asset.name) : "Not given"],
    ["Where", where ?? "—"],
    ["Urgency", PRIORITY_LABEL[r.priority]],
    ["Reported by", r.requestedBy ? userLabel(r.requestedBy) : "—"],
    ["Reported", formatDateTime(r.createdAt)],
    ...(r.reviewedAt ? ([["Reviewed", `${formatDateTime(r.reviewedAt)}${r.reviewedBy ? ` by ${userLabel(r.reviewedBy)}` : ""}`]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <>
      {submitted && (
        <div className="mb-5 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <strong>Thanks — your request was sent</strong> as {requestNumber(r.number)}. Maintenance will review it.{" "}
          <Link href="/requests/new" className="link">
            Report another
          </Link>
        </div>
      )}
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
          {requestNumber(r.number)}
          <RequestStatusBadge status={r.status} />
          {r.assetDown && <DownBadge since="reported down" />}
        </div>
        <h1 className="mt-1 text-xl font-semibold">{r.title}</h1>
      </div>

      <div className="grid gap-6 @4xl:grid-cols-3">
        <div className="space-y-6 @4xl:col-span-2">
          <Card title="Details">
            <p className="text-sm whitespace-pre-wrap">{r.description ?? <span className="text-neutral-500">No details given.</span>}</p>
          </Card>

          {r.status === "PENDING" && !pending && (
            <Card title="Status">
              <p className="text-sm text-neutral-600">Waiting for a supervisor to review it.</p>
            </Card>
          )}
          {r.status === "APPROVED" && r.workOrder && (
            <Card title="Work order">
              <p className="text-sm">
                Approved as{" "}
                {can(user.role, "view") ? (
                  <Link href={`/work-orders/${r.workOrder.id}`} className="link">
                    {woNumber(r.workOrder.number)} — {r.workOrder.title}
                  </Link>
                ) : (
                  <strong className="font-medium">
                    {woNumber(r.workOrder.number)} — {r.workOrder.title}
                  </strong>
                )}{" "}
                ({STATUS_LABEL[r.workOrder.status].toLowerCase()}).
              </p>
              {r.reviewNote && <p className="mt-2 text-sm text-neutral-600">Note: {r.reviewNote}</p>}
            </Card>
          )}
          {r.status === "REJECTED" && (
            <Card title="Rejected">
              <p className="text-sm">{r.reviewNote}</p>
              {r.downtimes.some((d) => !d.endedAt) && r.asset && (
                <p className="mt-2 text-sm text-red-700">
                  {r.asset.name} is still marked down from this report.{" "}
                  <Link href={`/assets/${r.asset.id}`} className="link">
                    Open the asset
                  </Link>{" "}
                  to mark it back up if it's running.
                </p>
              )}
            </Card>
          )}

          {pending && (
            <>
              <Card title="Approve">
                <ApproveForm action={approveRequest.bind(null, r.id)} assets={assets} users={users} defaults={{ assetId: r.assetId, priority: r.priority }} />
              </Card>
              <Card title="Reject">
                <RejectForm action={rejectRequest.bind(null, r.id)} />
              </Card>
            </>
          )}
        </div>
        <Card title="Request">
          <dl className="space-y-2.5 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
