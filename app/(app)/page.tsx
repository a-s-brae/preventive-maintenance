import Link from "next/link";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { loadSampleAssets } from "@/lib/actions";
import { downtimeHours, formatDuration, requestNumber } from "@/lib/downtime";
import { formatQty, stockStatus } from "@/lib/parts";
import { can } from "@/lib/permissions";
import { getAllOpenWorkOrders, userLabel } from "@/lib/queries";
import { woNumber } from "@/lib/work-orders";
import { OpenWorkOrderList } from "@/components/work-order-table";
import { ButtonLink, Card, DownBadge, Empty, PageHeader, PriorityText, RequestStatusBadge, StockBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const notice = denied && (
    <p className="mb-5 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
      You don&apos;t have access to that page. Ask an admin if you need it.
    </p>
  );
  if (!can(user.role, "view")) return <RequesterHome userId={user.id} notice={notice} />;
  const [open, assetCount, down, pendingRequests, parts] = await Promise.all([
    getAllOpenWorkOrders(),
    db.asset.count(),
    db.downtime.findMany({ where: { endedAt: null }, orderBy: { startedAt: "asc" }, include: { asset: true, workOrder: true } }),
    db.request.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 5, include: { asset: true, requestedBy: true } }),
    db.part.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  const lowStock = parts.filter((p) => stockStatus(p) !== "OK");
  const now = new Date();
  const attention = open.filter((wo) => wo.due.status === "OVERDUE" || wo.due.status === "DUE_SOON");
  const mine = open.filter((wo) => wo.assignedToId === user.id);
  // Requests to review and low stock sit beside the work lists on wide screens.
  const side = pendingRequests.length > 0 || lowStock.length > 0;

  return (
    <>
      {notice}
      <PageHeader title="Dashboard">
        <ButtonLink href="/work-orders/new">+ Work order</ButtonLink>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Overdue" value={open.filter((wo) => wo.due.status === "OVERDUE").length} tone="text-red-700" href="/work-orders?due=overdue" />
        <Stat label="Due this week" value={open.filter((wo) => wo.due.status === "DUE_SOON").length} tone="text-amber-700" href="/work-orders?due=soon" />
        <Stat label="In progress" value={open.filter((wo) => wo.status === "IN_PROGRESS").length} tone="text-violet-700" href="/work-orders?status=IN_PROGRESS" />
        <Stat label="Assigned to me" value={mine.length} tone="text-sky-700" href="/work-orders?view=mine" />
      </div>

      {assetCount === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <h2 className="font-medium">No equipment yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add your first asset, or load a few sample assets (compressor, forklift, HVAC, extinguishers) to see how it works.
            You can delete the samples later.
          </p>
          {can(user.role, "manage") ? (
            <div className="mt-4 flex justify-center gap-2">
              <ButtonLink href="/assets/new">Add asset</ButtonLink>
              <form action={loadSampleAssets}>
                <button type="submit" className="btn-secondary">
                  Load sample equipment
                </button>
              </form>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">An admin needs to add the equipment first.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {down.length > 0 && (
            <section className="rounded-lg border border-red-200 bg-red-50 p-4">
              <h2 className="mb-2 flex items-center gap-2 font-medium text-red-900">
                <DownBadge /> {down.length} asset{down.length === 1 ? " is" : "s are"} down
              </h2>
              <ul className="divide-y divide-red-100 text-sm">
                {down.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <Link href={`/assets/${d.assetId}`} className="font-medium text-red-900 hover:underline">
                        {d.asset.name}
                      </Link>
                      {d.reason && <span className="text-red-800"> — {d.reason}</span>}
                    </div>
                    <div className="flex items-center gap-3 text-red-800">
                      <span className="tabular-nums">down {formatDuration(downtimeHours([d], d.startedAt, now, now))}</span>
                      {d.workOrder ? (
                        <Link href={`/work-orders/${d.workOrder.id}`} className="link">
                          {woNumber(d.workOrder.number)}
                        </Link>
                      ) : (
                        <Link href={`/work-orders/new?assetId=${d.assetId}`} className="link">
                          + Work order
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className={`grid gap-6 ${side ? "xl:grid-cols-3" : ""}`}>
            <div className="space-y-6 xl:col-span-2">
              <Card
                title="Needs attention"
                actions={
                  <Link href="/work-orders" className="link text-sm">
                    All work orders →
                  </Link>
                }
              >
                <OpenWorkOrderList rows={attention} empty="Nothing overdue or due this week. Nice." />
              </Card>
              {mine.length > 0 && (
                <Card title="Assigned to me">
                  <OpenWorkOrderList rows={mine} empty="" />
                </Card>
              )}
            </div>
            {side && (
              <div className="space-y-6">
                {pendingRequests.length > 0 && (
                  <Card
                    title="Requests waiting for review"
                    actions={
                      <Link href="/requests" className="link text-sm">
                        All requests →
                      </Link>
                    }
                  >
                    <ul className="divide-y divide-slate-100 text-sm">
                      {pendingRequests.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <div>
                            <Link href={`/requests/${r.id}`} className="link">
                              {r.title}
                            </Link>
                            <div className="text-xs text-slate-500">
                              {[requestNumber(r.number), r.asset?.name ?? "no equipment given", r.requestedBy && userLabel(r.requestedBy)].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {r.assetDown && <DownBadge />}
                            <PriorityText priority={r.priority} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
                {lowStock.length > 0 && (
                  <Card
                    title="Low stock"
                    actions={
                      <Link href="/parts?stock=low" className="link text-sm">
                        All parts →
                      </Link>
                    }
                  >
                    <ul className="divide-y divide-slate-100 text-sm">
                      {lowStock.slice(0, 6).map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                          <Link href={`/parts/${p.id}`} className="link">
                            {p.name}
                          </Link>
                          <span className="flex items-center gap-2 text-slate-600">
                            <span className="tabular-nums">
                              {formatQty(p.quantity)} {p.unit} left
                            </span>
                            <StockBadge status={stockStatus(p)} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone, href }: { label: string; value: number; tone: string; href: string }) {
  return (
    <Link href={href} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </Link>
  );
}

/** Home for requesters: report a problem and follow what they've reported. */
async function RequesterHome({ userId, notice }: { userId: string; notice: React.ReactNode }) {
  const requests = await db.request.findMany({
    where: { requestedById: userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { asset: true, workOrder: true },
  });
  return (
    <>
      {notice}
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
        <h1 className="text-xl font-semibold">Something wrong with equipment?</h1>
        <p className="mt-1 text-sm text-slate-700">Tell maintenance — it takes a minute.</p>
        <Link href="/requests/new" className="mt-4 inline-flex rounded-md bg-amber-500 px-5 py-2.5 font-semibold text-slate-900 hover:bg-amber-400">
          Report a problem
        </Link>
      </div>
      <Card title="My requests">
        {requests.length === 0 ? (
          <Empty>You haven&apos;t reported anything yet.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <Link href={`/requests/${r.id}`} className="link">
                    {r.title}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {[requestNumber(r.number), r.asset?.name].filter(Boolean).join(" · ")}
                    {r.workOrder && ` · ${woNumber(r.workOrder.number)} ${r.workOrder.status === "COMPLETE" ? "done" : "in the works"}`}
                  </div>
                </div>
                <RequestStatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
