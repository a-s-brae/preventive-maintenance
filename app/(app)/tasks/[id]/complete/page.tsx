import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { logWork } from "@/lib/actions";
import { computeDue, describeInterval } from "@/lib/schedule";
import { LogForm } from "@/components/log-form";
import { Card, DueText, PageHeader, StatusBadge } from "@/components/ui";

export default async function CompleteTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await db.pmTask.findUnique({ where: { id }, include: { asset: true } });
  if (!task) notFound();
  const due = computeDue(task, task.asset.currentMeter);

  return (
    <>
      <PageHeader title={`Complete PM — ${task.asset.name}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title={task.title}>
            <LogForm
              action={logWork.bind(null, { assetId: task.assetId, taskId: task.id })}
              checklist={task.checklist}
              meterUnit={task.asset.meterUnit}
              currentMeter={task.asset.currentMeter}
              meterRequired={task.usageEvery != null}
            />
          </Card>
        </div>
        <Card title="About this PM">
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <StatusBadge status={due.status} /> <DueText due={due} meterUnit={task.asset.meterUnit} />
            </div>
            <div className="text-slate-600">Interval: {describeInterval(task, task.asset.meterUnit)}</div>
            {task.estimatedMinutes && <div className="text-slate-600">Estimated time: {task.estimatedMinutes} min</div>}
            {task.instructions && <p className="whitespace-pre-wrap">{task.instructions}</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
