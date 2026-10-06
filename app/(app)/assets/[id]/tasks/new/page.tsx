import { requirePermission } from "@/auth";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { saveTask } from "@/lib/actions";
import { getUsers } from "@/lib/queries";
import { TaskForm } from "@/components/task-form";
import { Card, PageHeader } from "@/components/ui";

export default async function NewTaskPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("manage");
  const { id } = await params;
  const [asset, users] = await Promise.all([db.asset.findUnique({ where: { id } }), getUsers()]);
  if (!asset) notFound();
  return (
    <>
      <PageHeader title={`New PM schedule — ${asset.name}`} />
      <Card>
        <TaskForm
          action={saveTask.bind(null, { assetId: asset.id, taskId: null })}
          meterUnit={asset.meterUnit}
          currentMeter={asset.currentMeter}
          users={users}
        />
      </Card>
    </>
  );
}
