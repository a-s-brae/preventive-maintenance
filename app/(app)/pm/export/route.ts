import { auth } from "@/auth";
import { parseChecklist } from "@/lib/checklist";
import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { getPmSchedules, userLabel } from "@/lib/queries";
import { describeInterval } from "@/lib/schedule";
import { PRIORITY_LABEL, woNumber } from "@/lib/work-orders";

const STATUS = { OVERDUE: "Overdue", DUE_SOON: "Due soon", OK: "OK", NO_SCHEDULE: "No schedule" } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Sign in first", { status: 401 });
  const rows = await getPmSchedules({ asset: { status: { not: "RETIRED" } } });
  const csv = toCsv(
    ["PM", "Asset", "Asset tag", "Location", "Interval", "Status", "Next due date", "Next due meter", "Last done", "Open work order", "Priority", "Assigned to", "Checklist items", "Active"],
    rows.map(({ task, due, openWorkOrder }) => [
      task.title,
      task.asset.name,
      task.asset.assetTag,
      task.asset.location,
      describeInterval(task, task.asset.meterUnit),
      due && task.asset.status === "ACTIVE" ? STATUS[due.status] : "Paused",
      csvDate(due?.nextDueAt),
      due?.nextDueMeter,
      csvDate(task.lastDoneAt),
      openWorkOrder ? woNumber(openWorkOrder.number) : "",
      PRIORITY_LABEL[task.priority],
      task.defaultAssignee ? userLabel(task.defaultAssignee) : "",
      parseChecklist(task.checklist).length,
      task.active ? "Yes" : "No",
    ]),
  );
  return csvResponse(`pm-schedules-${csvDate(new Date())}.csv`, csv);
}
