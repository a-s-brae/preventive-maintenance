import Link from "next/link";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { loadSampleAssets } from "@/lib/actions";
import { getOpenWorkOrders } from "@/lib/queries";
import { OpenWorkOrderList } from "@/components/work-order-table";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requireUser();
  const [open, assetCount] = await Promise.all([getOpenWorkOrders(), db.asset.count()]);
  const attention = open.filter((wo) => wo.due.status === "OVERDUE" || wo.due.status === "DUE_SOON");
  const mine = open.filter((wo) => wo.assignedToId === user.id);

  return (
    <>
      <PageHeader title="Dashboard">
        <ButtonLink href="/work-orders/new">New work order</ButtonLink>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Overdue" value={open.filter((wo) => wo.due.status === "OVERDUE").length} tone="text-red-700" href="/work-orders" />
        <Stat label="Due this week" value={open.filter((wo) => wo.due.status === "DUE_SOON").length} tone="text-amber-700" href="/work-orders" />
        <Stat label="In progress" value={open.filter((wo) => wo.status === "IN_PROGRESS").length} tone="text-violet-700" href="/work-orders" />
        <Stat label="Assigned to me" value={mine.length} tone="text-sky-700" href="/work-orders?view=mine" />
      </div>

      {assetCount === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <h2 className="font-medium">No equipment yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add your first asset, or load a few sample assets (compressor, forklift, HVAC, extinguishers) to see how it works.
            You can delete the samples later.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <ButtonLink href="/assets/new">Add asset</ButtonLink>
            <form action={loadSampleAssets}>
              <button type="submit" className="btn-secondary">
                Load sample equipment
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
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
