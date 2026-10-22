import { requirePermission } from "@/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { parseChecklist } from "@/lib/checklist";
import { PmTabs } from "@/components/section-tabs";
import { ButtonLink, Card, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ChecklistsPage() {
  await requirePermission("manage");
  const templates = await db.checklistTemplate.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { tasks: true } } } });
  return (
    <>
      <PageHeader title="PM schedules">
        <ButtonLink href="/checklists/new">+ Template</ButtonLink>
      </PageHeader>
      <PmTabs active="checklists" showChecklists />
      <p className="mb-4 max-w-3xl text-sm text-neutral-600">
        Write a checklist once and use it on many PM schedules — one forklift inspection for every forklift. Change the template and every PM
        that follows it changes too.
      </p>
      <Card>
        {templates.length === 0 ? (
          <Empty>No templates yet. Click “+ Template”, or start one from a PM schedule’s checklist.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="py-2 pr-3 font-medium">Template</th>
                <th className="px-3 py-2 text-right font-medium">Items</th>
                <th className="py-2 pl-3 text-right font-medium">Used by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="py-2.5 pr-3">
                    <Link href={`/checklists/${t.id}`} className="link font-medium">
                      {t.name}
                    </Link>
                    {t.description && <div className="text-xs text-neutral-500">{t.description}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{parseChecklist(t.items).length}</td>
                  <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                    {t._count.tasks} PM {t._count.tasks === 1 ? "schedule" : "schedules"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
