import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { recordMeter, startPmNow } from "@/lib/actions";
import { describeInterval } from "@/lib/schedule";
import { formatDate, formatNumber } from "@/lib/forms";
import { getOpenWorkOrders, getPmSchedules, workOrderInclude } from "@/lib/queries";
import { woNumber } from "@/lib/work-orders";
import { MeterForm } from "@/components/meter-form";
import { CompletedWorkOrderTable, OpenWorkOrderList } from "@/components/work-order-table";
import { ButtonLink, Card, DueText, Empty, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });
  if (!asset) notFound();

  const [open, schedules, history] = await Promise.all([
    getOpenWorkOrders({ assetId: id }),
    getPmSchedules({ assetId: id }),
    db.workOrder.findMany({
      where: { assetId: id, status: "COMPLETE" },
      include: workOrderInclude,
      orderBy: [{ completedAt: "desc" }, { number: "desc" }],
      take: 25,
    }),
  ]);

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
        <ButtonLink href={`/work-orders/new?assetId=${asset.id}`} variant="secondary">
          New work order
        </ButtonLink>
        <ButtonLink href={`/assets/${asset.id}/edit`} variant="secondary">
          Edit
        </ButtonLink>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Open work orders">
            <OpenWorkOrderList rows={open} showAsset={false} empty="No open work orders." />
          </Card>

          <Card title="PM schedules" actions={<ButtonLink href={`/assets/${asset.id}/tasks/new`}>Add PM schedule</ButtonLink>}>
            {schedules.length === 0 ? (
              <Empty>No PM schedules yet.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>PM</th>
                      <th>Interval</th>
                      <th>Last done</th>
                      <th>Next due</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map(({ task, due, openWorkOrder }) => (
                      <tr key={task.id} className={task.active ? "" : "opacity-50"}>
                        <td>{due ? <StatusBadge status={due.status} /> : <span className="text-xs text-slate-500">paused</span>}</td>
                        <td>
                          <Link href={`/tasks/${task.id}/edit`} className="link">
                            {task.title}
                          </Link>
                          {Array.isArray(task.checklist) && task.checklist.length > 0 && (
                            <div className="text-xs text-slate-500">{task.checklist.length} checklist items</div>
                          )}
                        </td>
                        <td className="text-slate-600">{describeInterval(task, asset.meterUnit)}</td>
                        <td className="text-slate-600">{formatDate(task.lastDoneAt)}</td>
                        <td>{due ? <DueText due={due} meterUnit={asset.meterUnit} /> : "—"}</td>
                        <td className="text-right whitespace-nowrap">
                          {openWorkOrder ? (
                            <Link href={`/work-orders/${openWorkOrder.id}`} className="link">
                              {woNumber(openWorkOrder.number)} →
                            </Link>
                          ) : (
                            task.active &&
                            asset.status === "ACTIVE" && (
                              <form action={startPmNow.bind(null, task.id)}>
                                <button type="submit" className="link text-sm" title="Create the work order now, before it's due">
                                  Start early
                                </button>
                              </form>
                            )
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="History">
            <CompletedWorkOrderTable rows={history} showAsset={false} />
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
