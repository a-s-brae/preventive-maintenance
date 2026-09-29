import Link from "next/link";
import { db } from "@/lib/db";
import { LogTable } from "@/components/log-table";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const [logs, total] = await Promise.all([
    db.workLog.findMany({
      orderBy: [{ performedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { task: true, performedBy: true, asset: true },
    }),
    db.workLog.count(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader title="Work history" />
      <Card>
        <LogTable logs={logs} />
        {pages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            {page > 1 ? <Link href={`/history?page=${page - 1}`} className="link">← Newer</Link> : <span />}
            <span className="text-slate-500">Page {page} of {pages}</span>
            {page < pages ? <Link href={`/history?page=${page + 1}`} className="link">Older →</Link> : <span />}
          </div>
        )}
      </Card>
    </>
  );
}
