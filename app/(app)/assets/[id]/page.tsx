import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { recordMeter } from "@/lib/actions";
import { compareDue, computeDue, describeInterval } from "@/lib/schedule";
import { formatDate, formatNumber } from "@/lib/forms";
import { MeterForm } from "@/components/meter-form";
import { ButtonLink, Card, DueText, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { LogTable } from "@/components/log-table";

export const dynamic = "force-dynamic";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await db.asset.findUnique({
    where: { id },
    include: {
      tasks: true,
      logs: { orderBy: { performedAt: "desc" }, take: 25, include: { task: true, performedBy: true, asset: true } },
    },
  });
  if (!asset) notFound();

  const tasks = asset.tasks
    .map((t) => ({ task: t, due: t.active ? computeDue(t, asset.currentMeter) : null }))
    .sort((a, b) => (a.due && b.due ? compareDue(a.due, b.due) : a.due ? -1 : 1));

  const details: [string, string | null][] = [
    ["Asset tag", asset.assetTag],
    ["Category", asset.category],
    ["Location", asset.location],
    ["Manufacturer", asset.manufacturer],
    ["Model", asset.model],
    ["Serial number", asset.serialNumber],
    ["Status", asset.status.toLowerCase()],
  ];

  return (
    <>
      <PageHeader title={asset.name}>
        <ButtonLink href={`/assets/${asset.id}/log`} variant="secondary">
          Log repair / inspection
        </ButtonLink>
        <ButtonLink href={`/assets/${asset.id}/edit`} variant="secondary">
          Edit
        </ButtonLink>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="PM tasks" actions={<ButtonLink href={`/assets/${asset.id}/tasks/new`}>Add PM task</ButtonLink>}>
            {tasks.length === 0 ? (
              <Empty>No PM tasks yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Task</th>
                      <th>Interval</th>
                      <th>Last done</th>
                      <th>Next due</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(({ task, due }) => (
                      <tr key={task.id} className={task.active ? "" : "opacity-50"}>
                        <td>{due ? <StatusBadge status={due.status} /> : <span className="text-xs text-slate-500">paused</span>}</td>
                        <td>
                          <Link href={`/tasks/${task.id}/edit`} className="link">
                            {task.title}
                          </Link>
                          {task.checklist.length > 0 && (
                            <div className="text-xs text-slate-500">{task.checklist.length} checklist items</div>
                          )}
                        </td>
                        <td className="text-slate-600">{describeInterval(task, asset.meterUnit)}</td>
                        <td className="text-slate-600">{formatDate(task.lastDoneAt)}</td>
                        <td>{due ? <DueText due={due} meterUnit={asset.meterUnit} /> : "—"}</td>
                        <td className="text-right">
                          {task.active && (
                            <Link href={`/tasks/${task.id}/complete`} className="link whitespace-nowrap">
                              Complete →
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Recent work">
            <LogTable logs={asset.logs} showAsset={false} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Details">
            <dl className="space-y-2 text-sm">
              {details.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="text-right">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
            {asset.notes && <p className="mt-4 text-sm whitespace-pre-wrap text-slate-700">{asset.notes}</p>}
          </Card>

          {asset.meterUnit && (
            <Card title="Meter">
              <div className="mb-3">
                <div className="text-2xl font-semibold tabular-nums">
                  {formatNumber(asset.currentMeter)} <span className="text-base font-normal text-slate-500">{asset.meterUnit}</span>
                </div>
                <div className="text-xs text-slate-500">Updated {formatDate(asset.meterUpdatedAt)}</div>
              </div>
              <MeterForm action={recordMeter.bind(null, asset.id)} meterUnit={asset.meterUnit} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
