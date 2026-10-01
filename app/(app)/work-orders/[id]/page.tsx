import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { completeWorkOrder, saveChecklistAnswer, setWorkOrderStatus } from "@/lib/actions";
import { draftAnswers, parseChecklist, parseResults } from "@/lib/checklist";
import { formatDate, formatNumber } from "@/lib/forms";
import { userLabel } from "@/lib/queries";
import { describeInterval } from "@/lib/schedule";
import { TYPE_LABEL, woNumber, workOrderDue } from "@/lib/work-orders";
import { ChecklistResults } from "@/components/checklist-results";
import { CompleteForm } from "@/components/complete-form";
import { ButtonLink, Card, PriorityText, StatusBadge, WoDueText, WoStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wo = await db.workOrder.findUnique({
    where: { id },
    include: { asset: true, pmTask: true, assignedTo: true, createdBy: true, completedBy: true },
  });
  if (!wo) notFound();
  const due = workOrderDue(wo, wo.asset.currentMeter, wo.pmTask?.usageEvery ?? null);
  const complete = wo.status === "COMPLETE";
  const checklist = parseChecklist(wo.checklist);

  const statusButton = (status: "OPEN" | "IN_PROGRESS" | "ON_HOLD", label: string, primary = false) => (
    <form action={setWorkOrderStatus.bind(null, wo.id, status)}>
      <button type="submit" className={primary ? "btn-primary" : "btn-secondary"}>
        {label}
      </button>
    </form>
  );

  const details: [string, React.ReactNode][] = [
    [
      "Asset",
      <Link key="a" href={`/assets/${wo.asset.id}`} className="link">
        {wo.asset.name}
      </Link>,
    ],
    ["Location", wo.asset.location ?? "—"],
    ["Type", TYPE_LABEL[wo.type]],
    ["Priority", <PriorityText key="p" priority={wo.priority} />],
    ["Assigned to", userLabel(wo.assignedTo)],
    [
      "Due",
      complete ? (
        <WoDueText key="d" dueDate={wo.dueDate} dueMeter={wo.dueMeter} daysLeft={null} meterUnit={wo.asset.meterUnit} />
      ) : (
        <span key="d" className="inline-flex flex-col items-end gap-1">
          {due.status !== "NO_SCHEDULE" && <StatusBadge status={due.status} />}
          <WoDueText dueDate={wo.dueDate} dueMeter={wo.dueMeter} daysLeft={due.daysLeft} meterLeft={due.meterLeft} meterUnit={wo.asset.meterUnit} />
        </span>
      ),
    ],
    ...(wo.pmTask
      ? ([
          [
            "PM schedule",
            <Link key="pm" href={`/tasks/${wo.pmTask.id}/edit`} className="link">
              {describeInterval(wo.pmTask, wo.asset.meterUnit)}
            </Link>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    ...(wo.pmTask?.estimatedMinutes ? ([["Estimated time", `${wo.pmTask.estimatedMinutes} min`]] as [string, React.ReactNode][]) : []),
    ["Created", `${formatDate(wo.createdAt)}${wo.createdBy ? ` by ${userLabel(wo.createdBy)}` : wo.type === "PM" ? " by PM schedule" : ""}`],
    ...(wo.startedAt ? ([["Started", formatDate(wo.startedAt)]] as [string, React.ReactNode][]) : []),
    ...(complete ? ([["Completed", `${formatDate(wo.completedAt)} by ${userLabel(wo.completedBy)}`]] as [string, React.ReactNode][]) : []),
    ...(wo.meterReading != null ? ([["Meter at completion", `${formatNumber(wo.meterReading)} ${wo.asset.meterUnit ?? ""}`]] as [string, React.ReactNode][]) : []),
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {woNumber(wo.number)} <WoStatusBadge status={wo.status} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{wo.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {wo.status === "OPEN" && statusButton("IN_PROGRESS", "Start work", true)}
          {wo.status === "IN_PROGRESS" && statusButton("ON_HOLD", "Put on hold")}
          {wo.status === "ON_HOLD" && statusButton("IN_PROGRESS", "Resume", true)}
          {!complete && (
            <ButtonLink href={`/work-orders/${wo.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {(wo.description || wo.pmTask?.instructions) && (
            <Card title="Instructions">
              <p className="text-sm whitespace-pre-wrap">{wo.description ?? wo.pmTask?.instructions}</p>
            </Card>
          )}
          {complete ? (
            <Card title="Results">
              <div className="space-y-4">
                <ChecklistResults results={parseResults(wo.checklistResults)} />
                {wo.completionNotes ? (
                  <p className="text-sm whitespace-pre-wrap">{wo.completionNotes}</p>
                ) : (
                  <p className="text-sm text-slate-500">No notes.</p>
                )}
              </div>
            </Card>
          ) : (
            <Card title="Complete this work order">
              <CompleteForm
                action={completeWorkOrder.bind(null, wo.id)}
                saveAnswer={saveChecklistAnswer.bind(null, wo.id)}
                checklist={checklist}
                drafts={draftAnswers(checklist, wo.checklistResults)}
                meterUnit={wo.asset.meterUnit}
                currentMeter={wo.asset.currentMeter}
                meterRequired={wo.dueMeter != null}
              />
            </Card>
          )}
        </div>
        <Card title="Details">
          <dl className="space-y-2.5 text-sm">
            {details.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
