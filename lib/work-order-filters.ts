// Filters for the work order list, read from the URL. Shared by the list page
// and its CSV export so the export always matches what's on screen.
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getOpenWorkOrders, workOrderInclude } from "@/lib/queries";

export const VIEWS = [
  { key: "open", label: "Open" },
  { key: "mine", label: "Assigned to me" },
  { key: "complete", label: "Completed" },
] as const;
export type View = (typeof VIEWS)[number]["key"];

export const STATUS_FILTERS = ["OPEN", "IN_PROGRESS", "ON_HOLD"] as const;
export const PRIORITY_FILTERS = ["HIGH", "MEDIUM", "LOW", "NONE"] as const;
export const DUE_FILTERS = ["overdue", "soon"] as const;
const TYPES = ["PM", "REPAIR", "INSPECTION"] as const;

export interface WorkOrderFilters {
  view: View;
  q?: string;
  type?: (typeof TYPES)[number];
  status?: (typeof STATUS_FILTERS)[number];
  priority?: (typeof PRIORITY_FILTERS)[number];
  due?: (typeof DUE_FILTERS)[number];
}

type Params = Record<string, string | string[] | undefined>;

const pick = <T extends readonly string[]>(options: T, value: unknown): T[number] | undefined =>
  options.includes(value as string) ? (value as T[number]) : undefined;

export function parseFilters(params: Params): WorkOrderFilters {
  const one = (k: string) => (Array.isArray(params[k]) ? params[k]![0] : params[k]);
  const view = pick(VIEWS.map((v) => v.key), one("view")) ?? "open";
  const open = view !== "complete";
  return {
    view,
    q: one("q")?.trim() || undefined,
    type: pick(TYPES, one("type")),
    // Status and due filters only apply to open work orders.
    status: open ? pick(STATUS_FILTERS, one("status")) : undefined,
    priority: pick(PRIORITY_FILTERS, one("priority")),
    due: open ? pick(DUE_FILTERS, one("due")) : undefined,
  };
}

/** The URL for these filters with some of them changed (undefined = cleared). */
export function filtersHref(base: string, f: WorkOrderFilters, change: Partial<WorkOrderFilters> = {}): string {
  const next = { ...f, ...change };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(next)) if (v && !(k === "view" && v === "open")) qs.set(k, v);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

function where(f: WorkOrderFilters): Prisma.WorkOrderWhereInput {
  const num = f.q?.replace(/^wo-?/i, "");
  return {
    ...(f.type && { type: f.type }),
    ...(f.priority && { priority: f.priority }),
    ...(f.status && { status: f.status }),
    ...(f.q && {
      OR: [
        { title: { contains: f.q, mode: "insensitive" } },
        { asset: { name: { contains: f.q, mode: "insensitive" } } },
        ...(num && /^\d+$/.test(num) ? [{ number: Number(num) }] : []),
      ],
    }),
  };
}

export async function loadOpenWorkOrders(f: WorkOrderFilters, userId: string) {
  const rows = await getOpenWorkOrders({ ...where(f), ...(f.view === "mine" && { assignedToId: userId }) });
  if (f.due === "overdue") return rows.filter((r) => r.due.status === "OVERDUE");
  if (f.due === "soon") return rows.filter((r) => r.due.status === "DUE_SOON");
  return rows;
}

export function loadCompletedWorkOrders(f: WorkOrderFilters, take?: number) {
  return db.workOrder.findMany({
    where: { ...where(f), status: "COMPLETE" },
    include: workOrderInclude,
    orderBy: [{ completedAt: "desc" }, { number: "desc" }],
    take,
  });
}
