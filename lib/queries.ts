import { cache } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { compareDue, computeDue } from "@/lib/schedule";
import { parseChecklist } from "@/lib/checklist";
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
  const unread = await db.notification.count({ where: { userId, readAt: null } });
  if (!staff) return { overdue: 0, mine: 0, pendingRequests: 0, lowStock: 0, unread };
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
    unread,
  };
}

const person = { select: { id: true, name: true, email: true } } as const;
type Person = { id: string; name: string | null; email: string } | null;

export interface RailData {
  notifications: { id: string; title: string; href: string; at: string; read: boolean }[];
  activity: { id: string; who: { id: string; name: string | null; email: string } | null; text: string; href: string; at: string }[];
  team: { id: string; name: string | null; email: string; role: "ADMIN" | "TECH" }[];
}

/** The right-hand panel: your latest notifications, what the team did lately, and who's on it. */
export async function getRailData(userId: string): Promise<RailData> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const take = 6;
  const [notifications, completed, created, requests, downs, team] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 4 }),
    db.workOrder.findMany({
      where: { status: "COMPLETE", completedAt: { gte: since } },
      orderBy: { completedAt: "desc" },
      take,
      select: { id: true, title: true, completedAt: true, completedBy: person },
    }),
    // Work orders people raised (PM work orders the schedule makes have no creator).
    db.workOrder.findMany({
      where: { createdAt: { gte: since }, createdById: { not: null } },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, title: true, createdAt: true, createdBy: person },
    }),
    db.request.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, title: true, createdAt: true, requestedBy: person },
    }),
    db.downtime.findMany({
      where: { startedAt: { gte: since } },
      orderBy: { startedAt: "desc" },
      take,
      select: { id: true, startedAt: true, asset: { select: { id: true, name: true } }, startedBy: person },
    }),
    db.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "TECH"] } },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      take: 8,
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);
  const item = (id: string, who: Person, text: string, href: string, at: Date) => ({ id, who, text, href, at: at.toISOString() });
  const activity = [
    ...completed.map((w) => item(`c${w.id}`, w.completedBy, `Completed “${w.title}”`, `/work-orders/${w.id}`, w.completedAt!)),
    ...created.map((w) => item(`w${w.id}`, w.createdBy, `Opened “${w.title}”`, `/work-orders/${w.id}`, w.createdAt)),
    ...requests.map((r) => item(`r${r.id}`, r.requestedBy, `Reported “${r.title}”`, `/requests/${r.id}`, r.createdAt)),
    ...downs.map((d) => item(`d${d.id}`, d.startedBy, `Marked ${d.asset.name} down`, `/assets/${d.asset.id}`, d.startedAt)),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, take);
  return {
    notifications: notifications.map((n) => ({ id: n.id, title: n.title, href: n.href, at: n.createdAt.toISOString(), read: n.readAt != null })),
    activity,
    team: team.map((u) => ({ ...u, role: u.role as "ADMIN" | "TECH" })),
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

/** Checklist templates for pickers, with their items parsed. */
export async function getChecklistTemplates() {
  const rows = await db.checklistTemplate.findMany({ orderBy: { name: "asc" } });
  return rows.map((t) => ({ id: t.id, name: t.name, items: parseChecklist(t.items) }));
}

export function getUsers() {
  return db.user.findMany({ orderBy: [{ name: "asc" }, { email: "asc" }], select: { id: true, name: true, email: true } });
}

export type UserOption = Awaited<ReturnType<typeof getUsers>>[number];

export const userLabel = (u: { name: string | null; email: string } | null | undefined) => (u ? (u.name ?? u.email) : "Unassigned");
