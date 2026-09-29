import Link from "next/link";
import { db } from "@/lib/db";
import { loadSampleAssets } from "@/lib/actions";
import { getScheduledTasks } from "@/lib/queries";
import { describeInterval } from "@/lib/schedule";
import { ButtonLink, Card, DueText, Empty, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [rows, assetCount] = await Promise.all([getScheduledTasks(), db.asset.count()]);
  const count = (s: string) => rows.filter((r) => r.due.status === s).length;
  const actionable = rows.filter((r) => r.due.status === "OVERDUE" || r.due.status === "DUE_SOON");

  return (
    <>
      <PageHeader title="Dashboard">
        <ButtonLink href="/assets/new">Add asset</ButtonLink>
      </PageHeader>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <Stat label="Overdue" value={count("OVERDUE")} tone="text-red-700" />
        <Stat label="Due soon" value={count("DUE_SOON")} tone="text-amber-700" />
        <Stat label="On schedule" value={count("OK")} tone="text-emerald-700" />
      </div>

      {assetCount === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <h2 className="font-medium">No equipment yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add your first asset, or load a few sample assets (compressor, forklift, HVAC, extinguishers) to see how it works.
            You can delete the samples later.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <ButtonLink href="/assets/new">Add asset</ButtonLink>
            <form action={loadSampleAssets}>
              <button type="submit" className="btn-secondary">
                Load sample equipment
              </button>
            </form>
          </div>
        </div>
      ) : (
        <Card title="Needs attention">
          {actionable.length === 0 ? (
            <Empty>{rows.length === 0 ? "No PM tasks yet — open an asset and add one." : "Nothing is due. Nice."}</Empty>
          ) : (
            <>
              <ul className="divide-y divide-slate-100 sm:hidden">
                {actionable.map(({ task, due }) => (
                  <li key={task.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <Link href={`/assets/${task.asset.id}`} className="link text-sm">
                          {task.asset.name}
                        </Link>
                      </div>
                      <StatusBadge status={due.status} />
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      <DueText due={due} meterUnit={task.asset.meterUnit} />
                    </div>
                    <Link href={`/tasks/${task.id}/complete`} className="btn-secondary mt-2 w-full">
                      Complete
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="hidden overflow-x-auto sm:block">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Asset</th>
                      <th>Task</th>
                      <th>Interval</th>
                      <th>Due</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {actionable.map(({ task, due }) => (
                      <tr key={task.id}>
                        <td>
                          <StatusBadge status={due.status} />
                        </td>
                        <td>
                          <Link href={`/assets/${task.asset.id}`} className="link">
                            {task.asset.name}
                          </Link>
                          <div className="text-xs text-slate-500">{task.asset.location}</div>
                        </td>
                        <td>{task.title}</td>
                        <td className="text-slate-600">{describeInterval(task, task.asset.meterUnit)}</td>
                        <td>
                          <DueText due={due} meterUnit={task.asset.meterUnit} />
                        </td>
                        <td className="text-right">
                          <Link href={`/tasks/${task.id}/complete`} className="link whitespace-nowrap">
                            Complete →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`text-3xl font-semibold tabular-nums ${tone}`}>{value}</div>
    </div>
  );
}
