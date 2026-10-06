import { requirePermission } from "@/auth";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteTask, saveTask } from "@/lib/actions";
import { getChecklistTemplates, getUsers } from "@/lib/queries";
import { TaskForm } from "@/components/task-form";
import { ConfirmButton } from "@/components/form";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("manage");
  const { id } = await params;
  const [task, users, templates] = await Promise.all([db.pmTask.findUnique({ where: { id }, include: { asset: true } }), getUsers(), getChecklistTemplates()]);
  if (!task) notFound();
  return (
    <>
      <PageHeader title={`Edit PM schedule — ${task.asset.name}`}>
        {!task.checklistTemplateId && Array.isArray(task.checklist) && task.checklist.length > 0 && (
          <ButtonLink href={`/checklists/new?from=${task.id}`} variant="secondary">
            Save checklist as template
          </ButtonLink>
        )}
        <ConfirmButton action={deleteTask.bind(null, task.id)} message="Delete this PM schedule? Its completed work orders are kept.">
          Delete schedule
        </ConfirmButton>
      </PageHeader>
      <Card>
        <TaskForm
          action={saveTask.bind(null, { assetId: task.assetId, taskId: task.id })}
          task={task}
          meterUnit={task.asset.meterUnit}
          currentMeter={task.asset.currentMeter}
          users={users}
          templates={templates}
        />
      </Card>
    </>
  );
}
