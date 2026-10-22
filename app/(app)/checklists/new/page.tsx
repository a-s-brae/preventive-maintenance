import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { saveTemplate } from "@/lib/actions";
import { parseChecklist } from "@/lib/checklist";
import { TemplateForm } from "@/components/template-form";
import { Card, PageHeader } from "@/components/ui";

/** ?from=<PM schedule id> starts the template from that PM's checklist. */
export default async function NewTemplatePage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  await requirePermission("manage");
  const { from } = await searchParams;
  const [source, pms] = await Promise.all([
    from ? db.pmTask.findUnique({ where: { id: from } }) : null,
    db.pmTask.findMany({
      where: { checklistTemplateId: null, NOT: { checklist: { equals: [] } } },
      select: { id: true, title: true, asset: { select: { name: true } } },
      orderBy: [{ asset: { name: "asc" } }, { title: "asc" }],
    }),
  ]);
  return (
    <>
      <PageHeader title="New checklist template" />
      {pms.length > 0 && (
        <form className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <label htmlFor="from" className="text-neutral-600">
            Start from a PM’s checklist:
          </label>
          <select id="from" name="from" defaultValue={source?.id ?? ""} className="input w-auto max-w-full py-1.5">
            <option value="">— Blank —</option>
            {pms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.asset.name} — {p.title}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-secondary py-1.5">
            Load
          </button>
        </form>
      )}
      <Card>
        {/* key: reload the form when a different starting checklist is picked */}
        <TemplateForm key={source?.id ?? "blank"} action={saveTemplate.bind(null, null)} name={source?.title} items={parseChecklist(source?.checklist)} />
      </Card>
    </>
  );
}
