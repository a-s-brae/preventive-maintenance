import Link from "next/link";
import { parseResults, summarize } from "@/lib/checklist";
import { formatDate } from "@/lib/forms";
import { userLabel, type WorkOrderRow } from "@/lib/queries";
import { TYPE_LABEL, woNumber } from "@/lib/work-orders";
import { Empty, PriorityText, StatusBadge, WoDueText, WoStatusBadge } from "./ui";

/** Open work orders: what's due, with urgency. Cards on phones, a table otherwise. */
export function OpenWorkOrderList({ rows, showAsset = true, empty }: { rows: WorkOrderRow[]; showAsset?: boolean; empty: string }) {
  if (rows.length === 0) return <Empty>{empty}</Empty>;
  return (
    <>
      <ul className="divide-y divide-slate-100 sm:hidden">
        {rows.map((wo) => (
          <li key={wo.id} className="py-3">
            <Link href={`/work-orders/${wo.id}`} className="block">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-slate-500">
                    {woNumber(wo.number)} · {TYPE_LABEL[wo.type]}
                  </div>
                  <div className="font-medium">{wo.title}</div>
                  {showAsset && <div className="text-sm text-sky-700">{wo.asset.name}</div>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <DueBadge row={wo} />
                  <WoStatusBadge status={wo.status} />
                </div>
              </div>
              <div className="mt-1 flex justify-between text-sm text-slate-600">
                <WoDueText dueDate={wo.dueDate} dueMeter={wo.dueMeter} daysLeft={wo.due.daysLeft} meterLeft={wo.due.meterLeft} meterUnit={wo.asset.meterUnit} />
                <span>{userLabel(wo.assignedTo)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="table">
          <thead>
            <tr>
              <th>Due</th>
              <th>Work order</th>
              {showAsset && <th>Asset</th>}
              <th>Status</th>
              <th>Priority</th>
              <th>Assigned to</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((wo) => (
              <tr key={wo.id}>
                <td>
                  <DueBadge row={wo} />
                  <div className="mt-1 text-xs text-slate-600">
                    <WoDueText dueDate={wo.dueDate} dueMeter={wo.dueMeter} daysLeft={wo.due.daysLeft} meterLeft={wo.due.meterLeft} meterUnit={wo.asset.meterUnit} />
                  </div>
                </td>
                <td>
                  <Link href={`/work-orders/${wo.id}`} className="link">
                    {wo.title}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {woNumber(wo.number)} · {TYPE_LABEL[wo.type]}
                  </div>
                </td>
                {showAsset && (
                  <td>
                    <Link href={`/assets/${wo.asset.id}`} className="link">
                      {wo.asset.name}
                    </Link>
                    <div className="text-xs text-slate-500">{wo.asset.location}</div>
                  </td>
                )}
                <td>
                  <WoStatusBadge status={wo.status} />
                </td>
                <td>
                  <PriorityText priority={wo.priority} />
                </td>
                <td className="text-slate-600">{userLabel(wo.assignedTo)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DueBadge({ row }: { row: WorkOrderRow }) {
  return row.due.status === "NO_SCHEDULE" ? <span className="text-xs text-slate-400">No due date</span> : <StatusBadge status={row.due.status} />;
}

type CompletedRow = Omit<WorkOrderRow, "due">;

/** Completed work orders: the maintenance history. */
export function CompletedWorkOrderTable({ rows, showAsset = true }: { rows: CompletedRow[]; showAsset?: boolean }) {
  if (rows.length === 0) return <Empty>No completed work yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Done</th>
            <th>Work order</th>
            {showAsset && <th>Asset</th>}
            <th>By</th>
            <th>Checklist</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((wo) => {
            const s = summarize(parseResults(wo.checklistResults));
            return (
              <tr key={wo.id}>
                <td className="whitespace-nowrap">{formatDate(wo.completedAt)}</td>
                <td>
                  <Link href={`/work-orders/${wo.id}`} className="link">
                    {wo.title}
                  </Link>
                  <div className="text-xs text-slate-500">
                    {woNumber(wo.number)} · {TYPE_LABEL[wo.type]}
                  </div>
                </td>
                {showAsset && (
                  <td>
                    <Link href={`/assets/${wo.asset.id}`} className="link">
                      {wo.asset.name}
                    </Link>
                  </td>
                )}
                <td className="text-slate-600">{userLabel(wo.completedBy)}</td>
                <td className="text-xs whitespace-nowrap">
                  {s.total === 0 ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <>
                      <span className={s.answered < s.total ? "text-amber-700" : "text-slate-600"}>
                        {s.answered}/{s.total} done
                      </span>
                      {s.failed > 0 && <span className="ml-1 font-medium text-red-700">· {s.failed} failed</span>}
                    </>
                  )}
                </td>
                <td className="max-w-xs whitespace-pre-wrap text-slate-600">{wo.completionNotes ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
