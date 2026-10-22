import { requirePermission } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { completeWorkOrder, saveChecklistAnswer, setWorkOrderStatus } from "@/lib/actions";
import { draftAnswers, parseChecklist, parseResults } from "@/lib/checklist";
import { formatDate, formatNumber } from "@/lib/forms";
import { userLabel } from "@/lib/queries";
import { describeInterval } from "@/lib/schedule";
import { STATUS_LABEL, TYPE_LABEL, woNumber, workOrderDue } from "@/lib/work-orders";
import { formatDateTime, requestNumber } from "@/lib/downtime";
import { formatMinutes, totalMinutes } from "@/lib/labor";
import { formatMoney, partsCost } from "@/lib/parts";
import { can } from "@/lib/permissions";
import { Attachments } from "@/components/attachments";
import { WorkOrderLabor } from "@/components/wo-labor";
import { WorkOrderParts } from "@/components/wo-parts";
import { ChecklistResults } from "@/components/checklist-results";
import { CompleteForm } from "@/components/complete-form";
import { MoreMenu } from "@/components/more-menu";
import { Card, PriorityText, StatusBadge, WoDueText, WoStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("view");
  const canWork = can(me.role, "work");
  const canManage = can(me.role, "manage");
  const { id } = await params;
  const wo = await db.workOrder.findUnique({
    where: { id },
    include: {
      asset: { include: { location: true, downtimes: { where: { endedAt: null }, take: 1 } } },
      pmTask: true,
      assignedTo: true,
      createdBy: true,
      completedBy: true,
      request: { include: { requestedBy: true } },
      partUsages: { include: { part: true, usedBy: true }, orderBy: { createdAt: "asc" } },
      labor: { include: { user: true }, orderBy: { startedAt: "asc" } },
      attachments: { include: { uploadedBy: true }, orderBy: { createdAt: "asc" } },
      followUpOf: { select: { id: true, number: true } },
      followUps: { select: { id: true, number: true, status: true }, orderBy: { number: "asc" } },
    },
  });
  if (!wo) notFound();
  const parts = canWork
    ? await db.part.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, partNumber: true, quantity: true, unit: true } })
    : [];
  const due = workOrderDue(wo, wo.asset.currentMeter, wo.pmTask?.usageEvery ?? null);
  const complete = wo.status === "COMPLETE";
  const checklist = parseChecklist(wo.checklist);
  const openDowntime = wo.asset.downtimes[0];

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
    ["Location", wo.asset.location?.name ?? "—"],
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
            canManage ? (
              <Link key="pm" href={`/tasks/${wo.pmTask.id}/edit`} className="link">
                {describeInterval(wo.pmTask, wo.asset.meterUnit)}
              </Link>
            ) : (
              describeInterval(wo.pmTask, wo.asset.meterUnit)
            ),
          ],
        ] as [string, React.ReactNode][])
      : []),
    ...(wo.pmTask?.estimatedMinutes ? ([["Estimated time", `${wo.pmTask.estimatedMinutes} min`]] as [string, React.ReactNode][]) : []),
    ...(wo.request
      ? ([
          [
            "From request",
            <Link key="req" href={`/requests/${wo.request.id}`} className="link">
              {requestNumber(wo.request.number)}
              {wo.request.requestedBy ? ` by ${userLabel(wo.request.requestedBy)}` : ""}
            </Link>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    ...(wo.followUpOf
      ? ([
          [
            "Follow-up of",
            <Link key="fuo" href={`/work-orders/${wo.followUpOf.id}`} className="link">
              {woNumber(wo.followUpOf.number)}
            </Link>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    ...(wo.followUps.length
      ? ([
          [
            "Follow-up work",
            <span key="fu" className="inline-flex flex-col items-end gap-1">
              {wo.followUps.map((f) => (
                <Link key={f.id} href={`/work-orders/${f.id}`} className="link">
                  {woNumber(f.number)} · {STATUS_LABEL[f.status]}
                </Link>
              ))}
            </span>,
          ],
        ] as [string, React.ReactNode][])
      : []),
    ["Created", `${formatDate(wo.createdAt)}${wo.createdBy ? ` by ${userLabel(wo.createdBy)}` : wo.type === "PM" ? " by PM schedule" : ""}`],
    ...(wo.startedAt ? ([["Started", formatDate(wo.startedAt)]] as [string, React.ReactNode][]) : []),
    ...(complete ? ([["Completed", `${formatDate(wo.completedAt)} by ${userLabel(wo.completedBy)}`]] as [string, React.ReactNode][]) : []),
    ...(wo.meterReading != null ? ([["Meter at completion", `${formatNumber(wo.meterReading)} ${wo.asset.meterUnit ?? ""}`]] as [string, React.ReactNode][]) : []),
    ["Time logged", formatMinutes(totalMinutes(wo.labor))],
    ["Parts cost", formatMoney(partsCost(wo.partUsages))],
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {woNumber(wo.number)} <WoStatusBadge status={wo.status} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{wo.title}</h1>
          {/* The essentials, so they're visible on a phone without scrolling to Details. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-600">
            <Link href={`/assets/${wo.asset.id}`} className="link">
              {wo.asset.name}
            </Link>
            {wo.asset.location && <span>· {wo.asset.location.name}</span>}
            {!complete && due.status !== "NO_SCHEDULE" && (
              <span className="inline-flex items-center gap-1">
                · <StatusBadge status={due.status} />
              </span>
            )}
            <span>· {userLabel(wo.assignedTo)}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MoreMenu
            items={[
              ...(canWork && !complete ? [{ label: "Edit work order", href: `/work-orders/${wo.id}/edit` }] : []),
              { label: "Print record", href: `/print/work-orders/${wo.id}`, newTab: true },
            ]}
          />
          {canWork && wo.status === "IN_PROGRESS" && statusButton("ON_HOLD", "Put on hold")}
          {canWork && wo.status === "OPEN" && statusButton("IN_PROGRESS", "Start work", true)}
          {canWork && wo.status === "ON_HOLD" && statusButton("IN_PROGRESS", "Resume", true)}
        </div>
      </div>

      {openDowntime && !complete && (
        <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          <strong>{wo.asset.name} is down</strong> since {formatDateTime(openDowntime.startedAt)}
          {openDowntime.reason ? ` — ${openDowntime.reason}` : ""}. Completing this work order can mark it back up.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
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
          ) : !canWork ? null : (
            <Card title="Complete this work order">
              <CompleteForm
                action={completeWorkOrder.bind(null, wo.id)}
                saveAnswer={saveChecklistAnswer.bind(null, wo.id)}
                checklist={checklist}
                drafts={draftAnswers(checklist, wo.checklistResults)}
                meterUnit={wo.asset.meterUnit}
                currentMeter={wo.asset.currentMeter}
                meterRequired={wo.dueMeter != null}
                assetDown={!!openDowntime}
              />
            </Card>
          )}
          <Card title="Time, parts & photos">
            <div className="divide-y divide-slate-100">
              <section className="pb-4">
                <h3 className="mb-2 text-sm font-medium text-slate-500">Time</h3>
                <WorkOrderLabor workOrderId={wo.id} entries={wo.labor} meId={me.id} canWork={canWork} canManage={canManage} open={!complete} />
              </section>
              <section className="py-4">
                <h3 className="mb-2 text-sm font-medium text-slate-500">Parts used</h3>
                <WorkOrderParts workOrderId={wo.id} usages={wo.partUsages} parts={parts} canEdit={canWork} />
              </section>
              <section className="pt-4">
                <h3 className="mb-2 text-sm font-medium text-slate-500">Photos &amp; files</h3>
                <Attachments
                  attachments={wo.attachments}
                  target={{ workOrderId: wo.id }}
                  canUpload={canWork}
                  canDelete={(a) => canWork && (a.uploadedById === me.id || canManage)}
                  emptyText={canWork ? null : "None."}
                />
              </section>
            </div>
          </Card>
        </div>
        <div className="self-start lg:sticky lg:top-6">
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
      </div>
    </>
  );
}
