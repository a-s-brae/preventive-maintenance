import Link from "next/link";
import type { Asset, PmTask, User, WorkLog } from "@prisma/client";
import { formatDate, formatNumber } from "@/lib/forms";
import { Empty } from "./ui";

type Log = WorkLog & { task: PmTask | null; performedBy: User | null; asset: Asset };
type CheckResult = { item: string; done: boolean };

const KIND_LABEL = { PM: "PM", REPAIR: "Repair", INSPECTION: "Inspection" } as const;

export function LogTable({ logs, showAsset = true }: { logs: Log[]; showAsset?: boolean }) {
  if (logs.length === 0) return <Empty>No work logged yet.</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Date</th>
            {showAsset && <th>Asset</th>}
            <th>Work</th>
            <th>By</th>
            <th>Meter</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const checks = (log.checklistResults as CheckResult[] | null) ?? [];
            const done = checks.filter((c) => c.done).length;
            return (
              <tr key={log.id}>
                <td className="whitespace-nowrap">{formatDate(log.performedAt)}</td>
                {showAsset && (
                  <td>
                    <Link href={`/assets/${log.asset.id}`} className="link">
                      {log.asset.name}
                    </Link>
                  </td>
                )}
                <td>
                  <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{KIND_LABEL[log.kind]}</span>
                  {log.task?.title ?? ""}
                  {checks.length > 0 && (
                    <div className={`text-xs ${done === checks.length ? "text-slate-500" : "text-amber-700"}`}>
                      {done}/{checks.length} checklist items
                    </div>
                  )}
                </td>
                <td className="text-slate-600">{log.performedBy?.name ?? log.performedBy?.email ?? "—"}</td>
                <td className="text-slate-600 tabular-nums">{log.meterReading != null ? formatNumber(log.meterReading) : "—"}</td>
                <td className="max-w-xs text-slate-600 whitespace-pre-wrap">{log.notes ?? ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
