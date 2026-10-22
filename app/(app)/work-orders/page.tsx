import Link from "next/link";
import { requirePermission } from "@/auth";
import { filtersHref, loadCompletedWorkOrders, loadOpenWorkOrders, parseFilters, PRIORITY_FILTERS, type WorkOrderFilters } from "@/lib/work-order-filters";
import { PRIORITY_LABEL, TYPE_LABEL } from "@/lib/work-orders";
import { MoreMenu } from "@/components/more-menu";
import { WorkOrderTabs } from "@/components/section-tabs";
import { CompletedWorkOrderTable, OpenWorkOrderList } from "@/components/work-order-table";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const BASE = "/work-orders";

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("view");
  const f = parseFilters(await searchParams);
  const open = f.view !== "complete";
  const rows = open ? await loadOpenWorkOrders(f, user.id) : await loadCompletedWorkOrders(f, 200);
  const filtered = !!(f.q || f.type || f.status || f.priority || f.due);

  // The less-used filters stay folded away unless one of them is on.
  const moreActive = !!f.type || (!!f.priority && f.priority !== "HIGH") || f.status === "OPEN";
  const chip = (label: string, change: Partial<WorkOrderFilters>, active: boolean) => (
    <Chip key={label} href={filtersHref(BASE, f, change)} active={active}>
      {label}
    </Chip>
  );

  return (
    <>
      <PageHeader title="Work orders">
        <MoreMenu items={[{ label: "Export to Excel (CSV)", href: filtersHref(`${BASE}/export`, f), download: true }]} />
        <ButtonLink href="/work-orders/new">+ Work order</ButtonLink>
      </PageHeader>
      <WorkOrderTabs active={f.view} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form role="search" className="w-full sm:w-72">
          {Object.entries(f).map(([k, v]) => (k !== "q" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <input name="q" type="search" defaultValue={f.q} placeholder="Search work orders…" aria-label="Search work orders" className="input" />
        </form>
        {open && (
          <>
            {chip("Overdue", { due: f.due === "overdue" ? undefined : "overdue" }, f.due === "overdue")}
            {chip("Due this week", { due: f.due === "soon" ? undefined : "soon" }, f.due === "soon")}
            {chip("In progress", { status: f.status === "IN_PROGRESS" ? undefined : "IN_PROGRESS" }, f.status === "IN_PROGRESS")}
            {chip("On hold", { status: f.status === "ON_HOLD" ? undefined : "ON_HOLD" }, f.status === "ON_HOLD")}
          </>
        )}
        {chip("High priority", { priority: f.priority === "HIGH" ? undefined : "HIGH" }, f.priority === "HIGH")}
        <details className="text-sm" open={moreActive}>
          <summary className="cursor-pointer rounded-lg px-2 py-1 text-neutral-600 select-none hover:bg-neutral-100 hover:text-ink">More filters</summary>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-surface p-3">
            <span className="text-xs text-neutral-500">Type</span>
            {(["PM", "REPAIR", "INSPECTION"] as const).map((t) => chip(TYPE_LABEL[t], { type: f.type === t ? undefined : t }, f.type === t))}
            <span className="ml-2 text-xs text-neutral-500">Priority</span>
            {PRIORITY_FILTERS.filter((p) => p !== "HIGH").map((p) => chip(PRIORITY_LABEL[p], { priority: f.priority === p ? undefined : p }, f.priority === p))}
            {open && (
              <>
                <span className="ml-2 text-xs text-neutral-500">Status</span>
                {chip("Not started", { status: f.status === "OPEN" ? undefined : "OPEN" }, f.status === "OPEN")}
              </>
            )}
          </div>
        </details>
        {filtered && (
          <Link href={filtersHref(BASE, { view: f.view })} className="link text-sm">
            Clear filters
          </Link>
        )}
      </div>

      <Card>
        {open ? (
          <OpenWorkOrderList
            rows={rows as Awaited<ReturnType<typeof loadOpenWorkOrders>>}
            empty={filtered ? "No work orders match these filters." : f.view === "mine" ? "Nothing assigned to you." : "No open work orders."}
          />
        ) : (
          <CompletedWorkOrderTable rows={rows} />
        )}
        <p className="mt-3 text-xs text-neutral-500">
          {rows.length} work order{rows.length === 1 ? "" : "s"}
          {!open && rows.length === 200 && (
            <>
              {" "}
              (latest 200 —{" "}
              <Link href="/history" className="link">
                see all completed work
              </Link>
              )
            </>
          )}
        </p>
      </Card>
    </>
  );
}

/** A filter you switch on and off. */
function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-pressed={active} className="chip">
      {children}
    </Link>
  );
}
