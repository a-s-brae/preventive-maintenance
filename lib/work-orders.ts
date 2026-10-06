// Work orders: the unit of maintenance work. PM schedules create them when
// they come due; repairs and inspections are created by hand.
import type { PmTask, Prisma, PrismaClient, WorkOrder } from "@prisma/client";
import { notify } from "@/lib/notify";
import { computeDue, daysUntil, USAGE_DUE_SOON_FRACTION, type DueStatus } from "@/lib/schedule";

type Db = PrismaClient | Prisma.TransactionClient;

export const STATUS_LABEL = { OPEN: "Open", IN_PROGRESS: "In progress", ON_HOLD: "On hold", COMPLETE: "Complete" } as const;
export const PRIORITY_LABEL = { NONE: "None", LOW: "Low", MEDIUM: "Medium", HIGH: "High" } as const;
export const TYPE_LABEL = { PM: "PM", REPAIR: "Repair", INSPECTION: "Inspection" } as const;

/** Open work orders due within this many days show as "due soon". */
export const WO_DUE_SOON_DAYS = 7;

export const woNumber = (n: number) => `WO-${String(n).padStart(4, "0")}`;

export const OPEN_STATUSES = ["OPEN", "IN_PROGRESS", "ON_HOLD"] as const;

/** Due status of an open work order, by date and (for usage PM) meter.
 *  `usageEvery` is the PM's usage interval, for the "due soon" window. */
export function workOrderDue(
  wo: Pick<WorkOrder, "status" | "dueDate" | "dueMeter">,
  currentMeter: number | null,
  usageEvery: number | null = null,
  now: Date = new Date(),
): { status: DueStatus; daysLeft: number | null; meterLeft: number | null } {
  const daysLeft = wo.dueDate ? daysUntil(wo.dueDate, now) : null;
  const meterLeft = wo.dueMeter != null && currentMeter != null ? wo.dueMeter - currentMeter : null;
  if (wo.status === "COMPLETE") return { status: "OK", daysLeft: null, meterLeft: null };
  if ((daysLeft != null && daysLeft < 0) || (meterLeft != null && meterLeft <= 0)) return { status: "OVERDUE", daysLeft, meterLeft };
  const meterSoon = meterLeft != null && usageEvery != null && meterLeft <= usageEvery * USAGE_DUE_SOON_FRACTION;
  if ((daysLeft != null && daysLeft <= WO_DUE_SOON_DAYS) || meterSoon) return { status: "DUE_SOON", daysLeft, meterLeft };
  return { status: wo.dueDate || wo.dueMeter != null ? "OK" : "NO_SCHEDULE", daysLeft, meterLeft };
}

/** Fields for a new work order from a PM schedule's current due point. */
function pmWorkOrderData(task: PmTask, currentMeter: number | null): Prisma.WorkOrderCreateManyInput {
  const due = computeDue(task, currentMeter);
  return {
    type: "PM",
    title: task.title,
    description: task.instructions,
    assetId: task.assetId,
    pmTaskId: task.id,
    openForTaskId: task.id,
    cycle: task.scheduleBasis === "FIXED" ? task.fixedCycle : null,
    dueDate: due.nextDueAt,
    dueMeter: due.nextDueMeter,
    checklist: task.checklist ?? [],
    priority: task.priority,
    assignedToId: task.defaultAssigneeId,
  };
}

/** Create work orders for every PM schedule that is due soon or overdue and
 *  doesn't already have one open. Safe to call often and concurrently: the
 *  unique openForTaskId means a schedule never gets two open work orders. */
export async function syncPmWorkOrders(db: Db): Promise<number> {
  const tasks = await db.pmTask.findMany({
    where: {
      active: true,
      asset: { status: "ACTIVE" },
      workOrders: { none: { status: { in: [...OPEN_STATUSES] } } },
    },
    include: { asset: { select: { currentMeter: true } } },
  });
  const now = new Date();
  const due = tasks.filter((t) => {
    const s = computeDue(t, t.asset.currentMeter, now).status;
    return s === "OVERDUE" || s === "DUE_SOON";
  });
  if (due.length === 0) return 0;
  const created = await db.workOrder.createManyAndReturn({
    data: due.map((t) => pmWorkOrderData(t, t.asset.currentMeter)),
    skipDuplicates: true,
    select: { id: true, number: true, title: true, assignedToId: true, dueDate: true },
  });
  // Tell each default assignee about their new PM work order.
  for (const wo of created) {
    if (!wo.assignedToId) continue;
    await notify(db, [wo.assignedToId], {
      title: `New PM ${woNumber(wo.number)}: ${wo.title}`,
      body: wo.dueDate ? `Due ${wo.dueDate.toISOString().slice(0, 10)}` : null,
      href: `/work-orders/${wo.id}`,
    });
  }
  return created.length;
}

/** Create the work order for a PM schedule now, even if it isn't due yet.
 *  Returns the open work order (new or existing). */
export async function openPmWorkOrder(db: Db, taskId: string): Promise<WorkOrder> {
  const task = await db.pmTask.findUniqueOrThrow({ where: { id: taskId }, include: { asset: true } });
  await db.workOrder.createMany({ data: [pmWorkOrderData(task, task.asset.currentMeter)], skipDuplicates: true });
  return db.workOrder.findUniqueOrThrow({ where: { openForTaskId: taskId } });
}

/** After a PM schedule is edited, bring its not-yet-started work order in line
 *  (title, checklist, due date…). Started work orders are left alone. */
export async function refreshOpenPmWorkOrder(db: Db, taskId: string): Promise<void> {
  const task = await db.pmTask.findUniqueOrThrow({ where: { id: taskId }, include: { asset: true } });
  const { openForTaskId: _key, pmTaskId: _task, assetId: _asset, type: _type, ...data } = pmWorkOrderData(task, task.asset.currentMeter);
  await db.workOrder.updateMany({ where: { openForTaskId: taskId, status: "OPEN" }, data });
}

/** A repair work order for the problems an inspection found. */
export function followUpFor(
  wo: Pick<WorkOrder, "id" | "number" | "title" | "assetId" | "priority">,
  problems: string[],
  foundOn: Date,
) {
  return {
    type: "REPAIR" as const,
    title: `Follow up: ${wo.title}`.slice(0, 200),
    description: [`Found during ${woNumber(wo.number)} on ${foundOn.toISOString().slice(0, 10)}:`, ...problems.map((p) => `- ${p}`)].join("\n"),
    assetId: wo.assetId,
    priority: wo.priority === "NONE" || wo.priority === "LOW" ? ("MEDIUM" as const) : wo.priority,
    followUpOfId: wo.id,
  };
}
