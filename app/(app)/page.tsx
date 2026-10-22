import Link from "next/link";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { loadSampleAssets } from "@/lib/actions";
import { downtimeHours, formatDuration, requestNumber } from "@/lib/downtime";
import { formatQty, stockStatus } from "@/lib/parts";
import { can } from "@/lib/permissions";
import { getAllOpenWorkOrders, userLabel } from "@/lib/queries";
import { buckets, formatHours, pmCompliance } from "@/lib/reports";
import { woNumber } from "@/lib/work-orders";
import { Donut } from "@/components/charts";
import { Columns, TrendCard } from "@/components/dash-charts";
import { OpenWorkOrderList } from "@/components/work-order-table";
import { ButtonLink, Card, Delta, DownBadge, Empty, PageHeader, PriorityText, RequestStatusBadge, StatTile, StockBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const notice = denied && (
    <p className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      You don&apos;t have access to that page. Ask an admin if you need it.
    </p>
  );
  if (!can(user.role, "view")) return <RequesterHome userId={user.id} notice={notice} />;

  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const tomorrow = new Date(today + DAY);
  // The last 12 weeks (Monday to Sunday), this one last.
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * DAY;
  const weeks = buckets({ from: new Date(monday - 11 * 7 * DAY), to: tomorrow });
  const since30 = new Date(now.getTime() - 30 * DAY);
  const since60 = new Date(now.getTime() - 60 * DAY);
  const last90 = { from: new Date(tomorrow.getTime() - 90 * DAY), to: tomorrow };

  const [open, assetCount, down, pendingRequests, parts, flow, downtimes, pmWorkOrders] = await Promise.all([
    getAllOpenWorkOrders(),
    db.asset.count(),
    db.downtime.findMany({ where: { endedAt: null }, orderBy: { startedAt: "asc" }, include: { asset: true, workOrder: true } }),
    db.request.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 5, include: { asset: true, requestedBy: true } }),
    db.part.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    // Everything open, plus what was finished in the chart's weeks: enough to count
    // what was opened and completed each week, and how much was open at each week's end.
    db.workOrder.findMany({
      where: { OR: [{ status: { not: "COMPLETE" } }, { completedAt: { gte: weeks[0].start } }] },
      select: { createdAt: true, completedAt: true },
    }),
    db.downtime.findMany({
      where: { startedAt: { lt: now }, OR: [{ endedAt: null }, { endedAt: { gte: since30 } }] },
      select: { startedAt: true, endedAt: true, asset: { select: { id: true, name: true } } },
    }),
    db.workOrder.findMany({
      where: { type: "PM", OR: [{ dueDate: { gte: last90.from, lt: last90.to } }, { dueDate: null, completedAt: { gte: last90.from, lt: last90.to } }] },
      select: { assetId: true, status: true, dueDate: true, dueMeter: true, completedAt: true, meterReading: true },
    }),
  ]);

  const lowStock = parts.filter((p) => stockStatus(p) !== "OK");
  const attention = open.filter((wo) => wo.due.status === "OVERDUE" || wo.due.status === "DUE_SOON");
  const overdue = open.filter((wo) => wo.due.status === "OVERDUE").length;
  const mine = open.filter((wo) => wo.assignedToId === user.id);
  const mineOverdue = mine.filter((wo) => wo.due.status === "OVERDUE").length;
  const between = (d: Date | null, from: Date, to: Date) => !!d && d >= from && d < to;
  const completed30 = flow.filter((w) => between(w.completedAt, since30, now)).length;
  const completedBefore = flow.filter((w) => between(w.completedAt, since60, since30)).length;

  // The trend: per week, opened and completed, and the open backlog at the week's end.
  const trend = weeks.map((w) => {
    const end = w.end < now ? w.end : now;
    return {
      opened: flow.filter((x) => between(x.createdAt, w.start, w.end)).length,
      completed: flow.filter((x) => between(x.completedAt, w.start, w.end)).length,
      backlog: flow.filter((x) => x.createdAt < end && (!x.completedAt || x.completedAt >= end)).length,
    };
  });

  // Open work per asset, most first.
  const byAsset = new Map<string, { id: string; name: string; count: number; overdue: number }>();
  for (const wo of open) {
    const a = byAsset.get(wo.assetId) ?? { id: wo.assetId, name: wo.asset.name, count: 0, overdue: 0 };
    a.count++;
    if (wo.due.status === "OVERDUE") a.overdue++;
    byAsset.set(wo.assetId, a);
  }
  const busiest = [...byAsset.values()].sort((a, b) => b.count - a.count || b.overdue - a.overdue || a.name.localeCompare(b.name)).slice(0, 6);

  // Hours down per asset over the last 30 days.
  const downBy = new Map<string, { id: string; name: string; hours: number }>();
  for (const d of downtimes) {
    const a = downBy.get(d.asset.id) ?? { ...d.asset, hours: 0 };
    a.hours += downtimeHours([d], since30, now, now);
    downBy.set(d.asset.id, a);
  }
  const mostDown = [...downBy.values()].filter((a) => a.hours > 0).sort((a, b) => b.hours - a.hours).slice(0, 6);

  const compliance = pmCompliance(pmWorkOrders, last90, now);
  // Requests to review and low stock sit beside the work lists on wide screens.
  const side = pendingRequests.length > 0 || lowStock.length > 0;

  return (
    <>
      {notice}
      <PageHeader title="Dashboard" />

      {down.length > 0 && (
        <section className="mb-6 rounded-2xl bg-red-50 p-5 sm:p-6">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-900">
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

      <div className="mb-6 grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6">
        <StatTile label="Overdue" value={overdue} detail={`of ${open.length} open`} alert={overdue > 0} href="/work-orders?due=overdue" />
        <StatTile tone="blue" label="Due this week" value={open.filter((wo) => wo.due.status === "DUE_SOON").length} detail="next 7 days" href="/work-orders?due=soon" />
        <StatTile
          label="Assigned to me"
          value={mine.length}
          detail={mineOverdue ? `${mineOverdue} overdue` : `${mine.filter((wo) => wo.status === "IN_PROGRESS").length} in progress`}
          alert={mineOverdue > 0}
          href="/work-orders?view=mine"
        />
        <StatTile
          tone="blue"
          label="Completed · 30 days"
          value={completed30}
          detail={<Delta now={completed30} before={completedBefore} period="vs the 30 days before" />}
          href="/work-orders?view=complete"
        />
      </div>

      {assetCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-6 text-center">
          <h2 className="text-sm font-semibold">No equipment yet</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Add your first asset, or load a few sample assets (compressor, forklift, HVAC, extinguishers) to see how it works. You can delete the
            samples later.
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
            <p className="mt-3 text-sm text-neutral-500">An admin needs to add the equipment first.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 @4xl:grid-cols-3">
            <div className="@4xl:col-span-2">
              <TrendCard
                title="Work orders"
                labels={weeks.map((w) => w.label)}
                titles={weeks.map((w, i) => `Week of ${w.label}${i === weeks.length - 1 ? " (so far)" : ""}`)}
                views={[
                  {
                    key: "flow",
                    label: "Completed vs opened",
                    series: [
                      { key: "completed", label: "Completed", color: "var(--color-chart-1)", values: trend.map((t) => t.completed) },
                      { key: "opened", label: "Opened", color: "var(--color-chart-2)", values: trend.map((t) => t.opened) },
                    ],
                  },
                  {
                    key: "backlog",
                    label: "Open backlog",
                    caption: "Work orders open at the end of each week",
                    series: [{ key: "backlog", label: "Open", color: "var(--color-chart-1)", values: trend.map((t) => t.backlog), area: true }],
                  },
                ]}
              />
            </div>
            <Card title="Open work by equipment">
              {busiest.length === 0 ? (
                <Empty>No open work orders.</Empty>
              ) : (
                <ul className="space-y-4">
                  {busiest.map((a) => (
                    <li key={a.id} className="text-sm">
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <Link href={`/assets/${a.id}`} className="min-w-0 truncate text-ink hover:underline" title={a.name}>
                          {a.name}
                        </Link>
                        <span className="shrink-0 text-ink tabular-nums">
                          {a.overdue > 0 && <span className="mr-2 text-xs text-red-700">{a.overdue} overdue</span>}
                          {a.count}
                        </span>
                      </div>
                      <div className="h-1.5" aria-hidden="true">
                        <div className="h-full rounded-r bg-chart-1" style={{ width: `${(a.count / busiest[0].count) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className={`grid gap-6 ${side ? "@6xl:grid-cols-3" : ""}`}>
            <div className="space-y-6 @6xl:col-span-2">
              <Card
                title="Needs attention"
                actions={
                  <Link href="/work-orders" className="text-xs text-neutral-500 hover:text-ink">
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
              <div className="grid content-start gap-6 @2xl:grid-cols-2 @6xl:grid-cols-1">
                {pendingRequests.length > 0 && (
                  <Card
                    title="Requests waiting for review"
                    actions={
                      <Link href="/requests" className="text-xs text-neutral-500 hover:text-ink">
                        All requests →
                      </Link>
                    }
                  >
                    <ul className="-my-2 divide-y divide-neutral-200/70 text-sm">
                      {pendingRequests.map((r) => (
                        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <div className="min-w-0">
                            <Link href={`/requests/${r.id}`} className="link">
                              {r.title}
                            </Link>
                            <div className="text-xs text-neutral-500">
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
                      <Link href="/parts?stock=low" className="text-xs text-neutral-500 hover:text-ink">
                        All parts →
                      </Link>
                    }
                  >
                    <ul className="-my-2 divide-y divide-neutral-200/70 text-sm">
                      {lowStock.slice(0, 6).map((p) => (
                        <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                          <Link href={`/parts/${p.id}`} className="link min-w-0 truncate">
                            {p.name}
                          </Link>
                          <span className="flex shrink-0 items-center gap-3 text-neutral-600">
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

          <div className="grid gap-6 @3xl:grid-cols-2">
            <Card title="Downtime by equipment · last 30 days">
              <Columns
                color="var(--color-chart-1)"
                rows={mostDown.map((a) => ({ key: a.id, label: a.name, href: `/assets/${a.id}?tab=downtime`, value: a.hours, display: formatHours(a.hours) }))}
                emptyText="No equipment was down in the last 30 days."
              />
            </Card>
            <Card title="PM compliance · last 90 days">
              <Donut
                center={compliance.percent == null ? "—" : `${compliance.percent}%`}
                centerLabel="on time"
                emptyText="No PMs were due in the last 90 days."
                slices={[
                  { key: "on-time", label: "Done on time", value: compliance.onTime, color: "var(--color-status-good)", mark: "check" },
                  { key: "late", label: "Done late", value: compliance.late, color: "var(--color-status-warning)", mark: "late" },
                  { key: "missed", label: "Missed (still open)", value: compliance.missed, color: "var(--color-status-critical)", mark: "cross" },
                ]}
              />
            </Card>
          </div>
        </div>
      )}
    </>
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
      <div className="mb-6 rounded-2xl bg-pastel-lavender p-6 text-center sm:p-8">
        <h1 className="text-lg font-semibold">Something wrong with equipment?</h1>
        <p className="mt-1 text-sm text-neutral-600">Tell maintenance — it takes a minute.</p>
        <Link href="/requests/new" className="btn-primary mt-4 px-5 py-2.5">
          Report a problem
        </Link>
      </div>
      <Card title="My requests">
        {requests.length === 0 ? (
          <Empty>You haven&apos;t reported anything yet.</Empty>
        ) : (
          <ul className="-my-2 divide-y divide-neutral-200/70 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <Link href={`/requests/${r.id}`} className="link">
                    {r.title}
                  </Link>
                  <div className="text-xs text-neutral-500">
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
