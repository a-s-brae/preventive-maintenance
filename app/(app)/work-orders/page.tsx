import Link from "next/link";
import { requirePermission } from "@/auth";
import { DUE_FILTERS, filtersHref, loadCompletedWorkOrders, loadOpenWorkOrders, parseFilters, PRIORITY_FILTERS, STATUS_FILTERS, VIEWS, type WorkOrderFilters } from "@/lib/work-order-filters";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/work-orders";
import { CompletedWorkOrderTable, OpenWorkOrderList } from "@/components/work-order-table";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const DUE_LABEL = { overdue: "Overdue", soon: "Due this week" } as const;
const BASE = "/work-orders";

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePermission("view");
  const f = parseFilters(await searchParams);
  const open = f.view !== "complete";
  const rows = open ? await loadOpenWorkOrders(f, user.id) : await loadCompletedWorkOrders(f, 200);
  const filtered = !!(f.q || f.type || f.status || f.priority || f.due);

  return (
    <>
      <PageHeader title="Work orders">
        <a href={filtersHref(`${BASE}/export`, f)} className="btn-secondary" download>
          Export CSV
        </a>
        <ButtonLink href="/work-orders/new">+ Work order</ButtonLink>
      </PageHeader>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              // Switching views keeps search, type and priority; status and due only apply to open ones.
              href={filtersHref(BASE, f, { view: v.key, ...(v.key === "complete" && { status: undefined, due: undefined }) })}
              className={`rounded-md px-3 py-1.5 ${f.view === v.key ? "bg-white font-medium shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap gap-2">
          {Object.entries(f).map(([k, v]) => (k !== "q" && k !== "type" && v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
          <input name="q" defaultValue={f.q} placeholder="Search title, asset, WO number…" className="input w-64" />
          <select name="type" defaultValue={f.type ?? ""} className="input w-auto">
            <option value="">All types</option>
            <option value="PM">PM</option>
            <option value="REPAIR">Repair</option>
            <option value="INSPECTION">Inspection</option>
          </select>
          <button className="btn-secondary">Search</button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {open && (
          <>
            <ChipGroup label="Due" f={f} field="due" options={DUE_FILTERS.map((d) => [d, DUE_LABEL[d]])} />
            <ChipGroup label="Status" f={f} field="status" options={STATUS_FILTERS.map((s) => [s, STATUS_LABEL[s]])} />
          </>
        )}
        <ChipGroup label="Priority" f={f} field="priority" options={PRIORITY_FILTERS.map((p) => [p, PRIORITY_LABEL[p]])} />
        {filtered && (
          <Link href={filtersHref(BASE, { view: f.view })} className="link text-xs">
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
        <p className="mt-3 text-xs text-slate-500">
          {rows.length} work order{rows.length === 1 ? "" : "s"}
          {!open && rows.length === 200 && " (latest 200 — use Export CSV or History for older ones)"}
        </p>
      </Card>
    </>
  );
}

/** A row of toggle chips for one filter: click to filter, click again to clear. */
function ChipGroup<K extends "due" | "status" | "priority">({
  label,
  f,
  field,
  options,
}: {
  label: string;
  f: WorkOrderFilters;
  field: K;
  options: [NonNullable<WorkOrderFilters[K]>, string][];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500">{label}:</span>
      {options.map(([value, text]) => {
        const active = f[field] === value;
        return (
          <Link
            key={value}
            href={filtersHref(BASE, f, { [field]: active ? undefined : value })}
            aria-pressed={active}
            className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${
              active ? "bg-sky-700 text-white ring-sky-700" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            {text}
          </Link>
        );
      })}
    </div>
  );
}
