import { requirePermission } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteTemplate, saveTemplate } from "@/lib/actions";
import { parseChecklist } from "@/lib/checklist";
import { describeInterval } from "@/lib/schedule";
import { ConfirmButton } from "@/components/form";
import { TemplateForm } from "@/components/template-form";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requirePermission("manage");
  const [{ id }, { saved }] = await Promise.all([params, searchParams]);
  const template = await db.checklistTemplate.findUnique({
    where: { id },
    include: { tasks: { include: { asset: true }, orderBy: [{ asset: { name: "asc" } }, { title: "asc" }] } },
  });
  if (!template) notFound();
  return (
    <>
      <PageHeader title={template.name}>
        <ConfirmButton
          action={deleteTemplate.bind(null, template.id)}
          message={`Delete this template?${template.tasks.length ? ` The ${template.tasks.length} PM schedule(s) using it keep their current checklist.` : ""}`}
        >
          Delete
        </ConfirmButton>
      </PageHeader>
      {saved && <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">Template saved.</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <TemplateForm
              key={template.updatedAt.toISOString()}
              action={saveTemplate.bind(null, template.id)}
              name={template.name}
              description={template.description}
              items={parseChecklist(template.items)}
              usedBy={template.tasks.length}
            />
          </Card>
        </div>
        <Card title="Used by">
          {template.tasks.length === 0 ? (
            <p className="text-sm text-slate-500">No PM schedules yet. Pick this template in a PM schedule’s checklist section.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {template.tasks.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}/edit`} className="link">
                    {t.asset.name}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {t.title} · {describeInterval(t, t.asset.meterUnit)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
