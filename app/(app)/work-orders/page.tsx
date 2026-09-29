import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { getOpenWorkOrders, workOrderInclude } from "@/lib/queries";
import { CompletedWorkOrderTable, OpenWorkOrderList } from "@/components/work-order-table";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Assigned to me" },
  { key: "complete", label: "Completed" },
] as const;
type View = (typeof VIEWS)[number]["key"];

export default async function WorkOrdersPage({ searchParams }: { searchParams: Promise<{ view?: string; q?: string; type?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const view: View = VIEWS.some((v) => v.key === params.view) ? (params.view as View) : "open";
  const q = params.q?.trim();
  const type = ["PM", "REPAIR", "INSPECTION"].includes(params.type ?? "") ? (params.type as "PM" | "REPAIR" | "INSPECTION") : undefined;

  const where: Prisma.WorkOrderWhereInput = {
    ...(type && { type }),
    ...(q && {
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { asset: { name: { contains: q, mode: "insensitive" } } },
        ...(/^\d+$/.test(q.replace(/^wo-/i, "")) ? [{ number: Number(q.replace(/^wo-/i, "")) }] : []),
      ],
    }),
  };

  const href = (v: View) => `/work-orders?${new URLSearchParams({ view: v, ...(q && { q }), ...(type && { type }) })}`;

  return (
    <>
      <PageHeader title="Work orders">
        <ButtonLink href="/work-orders/calendar" variant="secondary">
          Calendar
        </ButtonLink>
        <ButtonLink href="/work-orders/new">New work order</ButtonLink>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1 rounded-lg bg-slate-200/60 p-1 text-sm">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={href(v.key)}
              className={`rounded-md px-3 py-1.5 ${view === v.key ? "bg-white font-medium shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {v.label}
            </Link>
          ))}
        </nav>
        <form className="flex flex-wrap gap-2">
          <input type="hidden" name="view" value={view} />
          <input name="q" defaultValue={q} placeholder="Search title, asset, WO number…" className="input w-64" />
          <select name="type" defaultValue={type ?? ""} className="input w-auto">
            <option value="">All types</option>
            <option value="PM">PM</option>
            <option value="REPAIR">Repair</option>
            <option value="INSPECTION">Inspection</option>
          </select>
          <button className="btn-secondary">Filter</button>
        </form>
      </div>

      <Card>
        {view === "complete" ? (
          <CompletedWorkOrderTable
            rows={await db.workOrder.findMany({
              where: { ...where, status: "COMPLETE" },
              include: workOrderInclude,
              orderBy: [{ completedAt: "desc" }, { number: "desc" }],
              take: 200,
            })}
          />
        ) : (
          <OpenWorkOrderList
            rows={await getOpenWorkOrders(view === "mine" ? { ...where, assignedToId: user.id } : where)}
            empty={view === "mine" ? "Nothing assigned to you." : "No open work orders."}
          />
        )}
      </Card>
    </>
  );
}
