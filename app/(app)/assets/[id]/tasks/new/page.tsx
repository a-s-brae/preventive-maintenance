import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { saveTask } from "@/lib/actions";
import { TaskForm } from "@/components/task-form";
import { Card, PageHeader } from "@/components/ui";

export default async function NewTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });
  if (!asset) notFound();
  return (
    <>
      <PageHeader title={`New PM task — ${asset.name}`} />
      <Card>
        <TaskForm
          action={saveTask.bind(null, { assetId: asset.id, taskId: null })}
          meterUnit={asset.meterUnit}
          currentMeter={asset.currentMeter}
        />
      </Card>
    </>
  );
}
