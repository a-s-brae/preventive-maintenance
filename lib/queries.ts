import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { compareDue, computeDue } from "@/lib/schedule";
import { stockStatus } from "@/lib/parts";
import { flattenTree } from "@/lib/tree";
import { OPEN_STATUSES, syncPmWorkOrders, workOrderDue } from "@/lib/work-orders";

/** Create due PM work orders at most once per page render, however many
 *  queries on the page ask for it (concurrent syncs would waste WO numbers). */
const syncOnce = cache(() => syncPmWorkOrders(db));

const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 } as const;
const DUE_RANK = { OVERDUE: 0, DUE_SOON: 1, OK: 2, NO_SCHEDULE: 3 } as const;

export const workOrderInclude = {
  asset: { include: { location: true } },
  assignedTo: true,
  completedBy: true,
  pmTask: { select: { usageEvery: true } },
} satisfies Prisma.WorkOrderInclude;

export type WorkOrderRow = Prisma.WorkOrderGetPayload<{ include: typeof workOrderInclude }> & {
  due: ReturnType<typeof workOrderDue>;
};

/** Open work orders, most urgent first. Brings PM work orders up to date first. */
export async function getOpenWorkOrders(where: Prisma.WorkOrderWhereInput = {}): Promise<WorkOrderRow[]> {
  await syncOnce();
  const rows = await db.workOrder.findMany({
    // AND, not spread: the caller may filter on status too (e.g. only In progress).
    where: { AND: [where, { status: { in: [...OPEN_STATUSES] } }] },
    include: workOrderInclude,
  });
  const now = new Date();
  return rows
    .map((wo) => ({ ...wo, due: workOrderDue(wo, wo.asset.currentMeter, wo.pmTask?.usageEvery ?? null, now) }))
    .sort(
      (a, b) =>
        DUE_RANK[a.due.status] - DUE_RANK[b.due.status] ||
        (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.number - b.number,
    );
}

/** All open work orders, computed once per page render (the sidebar badges and
 *  the dashboard both use it). */
export const getAllOpenWorkOrders = cache(() => getOpenWorkOrders());

/** Counts for the sidebar badges. */
export async function getNavCounts(userId: string, staff: boolean) {
  if (!staff) return { overdue: 0, mine: 0, pendingRequests: 0, lowStock: 0 };
  const [open, pendingRequests, parts] = await Promise.all([
    getAllOpenWorkOrders(),
    db.request.count({ where: { status: "PENDING" } }),
    db.part.findMany({ where: { active: true }, select: { quantity: true, minQuantity: true } }),
  ]);
  return {
    overdue: open.filter((wo) => wo.due.status === "OVERDUE").length,
    mine: open.filter((wo) => wo.assignedToId === userId).length,
    pendingRequests,
    lowStock: parts.filter((p) => stockStatus(p) !== "OK").length,
  };
}

/** All locations as a tree (depth-first, with each one's path). */
export const getLocationTree = cache(async () => flattenTree(await db.location.findMany({ orderBy: { name: "asc" } })));

/** Assets as a tree, for pickers. Retired assets are left out unless asked for. */
export const getAssetTree = cache(async (includeRetired: boolean = false) =>
  flattenTree(
    await db.asset.findMany({
      where: includeRetired ? {} : { status: { not: "RETIRED" } },
      select: { id: true, name: true, parentId: true, assetTag: true, status: true, locationId: true },
    }),
  ),
);

export type LocationOption = Awaited<ReturnType<typeof getLocationTree>>[number];
export type AssetOption = Awaited<ReturnType<typeof getAssetTree>>[number];

/** PM schedules with due info and their open work order, most urgent first. */
export async function getPmSchedules(where: Prisma.PmTaskWhereInput = {}) {
  await syncOnce();
  const tasks = await db.pmTask.findMany({
    where,
    include: {
      asset: { include: { location: true } },
      defaultAssignee: true,
      workOrders: { where: { status: { in: [...OPEN_STATUSES] } }, take: 1 },
    },
  });
  const now = new Date();
  return tasks
    .map((task) => ({
      task,
      openWorkOrder: task.workOrders[0] ?? null,
      due: task.active ? computeDue(task, task.asset.currentMeter, now) : null,
    }))
    .sort((a, b) => (a.due && b.due ? compareDue(a.due, b.due) : a.due ? -1 : b.due ? 1 : 0));
}

export function getUsers() {
  return db.user.findMany({ orderBy: [{ name: "asc" }, { email: "asc" }], select: { id: true, name: true, email: true } });
}

export type UserOption = Awaited<ReturnType<typeof getUsers>>[number];

export const userLabel = (u: { name: string | null; email: string } | null | undefined) => (u ? (u.name ?? u.email) : "Unassigned");
