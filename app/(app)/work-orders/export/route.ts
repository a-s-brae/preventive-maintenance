import { currentUser } from "@/auth";
import { can } from "@/lib/permissions";
import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { parseResults, summarize } from "@/lib/checklist";
import { userLabel } from "@/lib/queries";
import { loadCompletedWorkOrders, loadOpenWorkOrders, parseFilters } from "@/lib/work-order-filters";
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, woNumber } from "@/lib/work-orders";

/** The work order list as CSV, with the same filters as the page. */
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.active === false) return new Response("Sign in first", { status: 401 });
  if (!can(user.role, "view")) return new Response("Not allowed", { status: 403 });
  const f = parseFilters(Object.fromEntries(new URL(req.url).searchParams));
  const rows = f.view === "complete" ? await loadCompletedWorkOrders(f) : await loadOpenWorkOrders(f, user.id);

  const csv = toCsv(
    ["Number", "Title", "Type", "Status", "Priority", "Asset", "Asset tag", "Location", "Assigned to", "Due date", "Due meter", "Created", "Completed", "Completed by", "Meter reading", "Checklist done", "Checklist problems", "Notes"],
    rows.map((wo) => {
      const s = summarize(parseResults(wo.checklistResults));
      return [
        woNumber(wo.number),
        wo.title,
        TYPE_LABEL[wo.type],
        STATUS_LABEL[wo.status],
        PRIORITY_LABEL[wo.priority],
        wo.asset.name,
        wo.asset.assetTag,
        wo.asset.location?.name,
        wo.assignedTo ? userLabel(wo.assignedTo) : "",
        csvDate(wo.dueDate),
        wo.dueMeter,
        csvDate(wo.createdAt),
        csvDate(wo.completedAt),
        wo.completedBy ? userLabel(wo.completedBy) : "",
        wo.meterReading,
        wo.status === "COMPLETE" && s.total ? `${s.answered}/${s.total}` : "",
        wo.status === "COMPLETE" && s.total ? s.failed : "",
        wo.completionNotes,
      ];
    }),
  );
  return csvResponse(`work-orders-${f.view}-${csvDate(new Date())}.csv`, csv);
}
