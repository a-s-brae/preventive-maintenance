import { requirePermission } from "@/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { workOrderInclude } from "@/lib/queries";
import { CompletedWorkOrderTable } from "@/components/work-order-table";
import { WorkOrderTabs } from "@/components/section-tabs";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requirePermission("view");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const where = { status: "COMPLETE" as const };
  const [rows, total] = await Promise.all([
    db.workOrder.findMany({
      where,
      orderBy: [{ completedAt: "desc" }, { number: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: workOrderInclude,
    }),
    db.workOrder.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Work orders" description="Every completed work order, newest first." />
      <WorkOrderTabs active="complete" />
      <Card>
        <CompletedWorkOrderTable rows={rows} />
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? <Link href={`/history?page=${page - 1}`} className="link">← Newer</Link> : <span />}
            <span className="text-neutral-500">Page {page} of {pages}</span>
            {page < pages ? <Link href={`/history?page=${page + 1}`} className="link">Older →</Link> : <span />}
          </div>
        )}
      </Card>
    </>
  );
}
