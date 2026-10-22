import type { LaborEntry, User } from "@prisma/client";
import { addLabor, deleteLabor, startTimer, stopTimer } from "@/lib/actions";
import { formatDate } from "@/lib/forms";
import { entryMinutes, formatMinutes, totalMinutes } from "@/lib/labor";
import { userLabel } from "@/lib/queries";
import { ConfirmButton } from "./form";
import { AddLaborForm } from "./labor-form";
import { Timer } from "./timer";

type Entry = LaborEntry & { user: User | null };

export function WorkOrderLabor({
  workOrderId,
  entries,
  meId,
  canWork,
  canManage,
  open,
}: {
  workOrderId: string;
  entries: Entry[];
  meId: string;
  canWork: boolean;
  canManage: boolean;
  /** The work order isn't complete yet. */
  open: boolean;
}) {
  const now = new Date();
  const mine = entries.find((e) => !e.endedAt && e.userId === meId);
  const others = entries.filter((e) => !e.endedAt && e.userId !== meId);
  const done = entries.filter((e) => e.endedAt).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm">
          {entries.length === 0 ? (
            <span className="text-neutral-500">No time logged yet.</span>
          ) : (
            <>
              Total: <strong className="font-semibold tabular-nums">{formatMinutes(totalMinutes(entries, now))}</strong>
            </>
          )}
          {others.length > 0 && (
            <span className="ml-2 text-neutral-500">
              ({others.map((e) => userLabel(e.user)).join(", ")} {others.length === 1 ? "is" : "are"} on the clock)
            </span>
          )}
        </div>
        {canWork && open && (
          mine ? (
            <form action={stopTimer.bind(null, workOrderId)} className="flex items-center gap-3">
              <span className="rounded-lg bg-violet-100 px-2 py-1 text-violet-900">
                ⏱ <Timer since={mine.startedAt.toISOString()} />
              </span>
              <button type="submit" className="btn-primary">
                Stop timer
              </button>
            </form>
          ) : (
            <form action={startTimer.bind(null, workOrderId)}>
              <button type="submit" className="btn-secondary">
                ⏱ Start timer
              </button>
            </form>
          )
        )}
      </div>
      {done.length > 0 && (
        <ul className="divide-y divide-neutral-100 text-sm">
          {done.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <strong className="font-medium tabular-nums">{formatMinutes(entryMinutes(e, now))}</strong>
                <span className="text-neutral-500">
                  {" "}
                  · {userLabel(e.user)} · {formatDate(e.startedAt)}
                  {e.note ? ` · ${e.note}` : ""}
                </span>
              </span>
              {canWork && (e.userId === meId || canManage) && (
                <ConfirmButton action={deleteLabor.bind(null, e.id)} message="Delete this time entry?" className="text-xs text-red-700 hover:underline">
                  Delete
                </ConfirmButton>
              )}
            </li>
          ))}
        </ul>
      )}
      {canWork && <AddLaborForm action={addLabor.bind(null, workOrderId)} />}
    </div>
  );
}
