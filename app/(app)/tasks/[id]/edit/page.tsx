import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteTask, saveTask } from "@/lib/actions";
import { getUsers } from "@/lib/queries";
import { TaskForm } from "@/components/task-form";
import { ConfirmButton } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [task, users] = await Promise.all([db.pmTask.findUnique({ where: { id }, include: { asset: true } }), getUsers()]);
  if (!task) notFound();
  return (
    <>
      <PageHeader title={`Edit PM schedule — ${task.asset.name}`}>
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
        />
      </Card>
    </>
  );
}
