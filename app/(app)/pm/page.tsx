import { requirePermission } from "@/auth";
import Link from "next/link";
import { startPmNow } from "@/lib/actions";
import { can } from "@/lib/permissions";
import { formatDate } from "@/lib/forms";
import { getPmSchedules, userLabel } from "@/lib/queries";
import { describeInterval } from "@/lib/schedule";
import { woNumber } from "@/lib/work-orders";
import { MoreMenu } from "@/components/more-menu";
import { PmTabs } from "@/components/section-tabs";
import { Card, DueText, Empty, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PmSchedulesPage() {
  const me = await requirePermission("view");
  const rows = await getPmSchedules({ asset: { status: { not: "RETIRED" } } });
  return (
    <>
      <PageHeader title="PM schedules">
        <MoreMenu items={[{ label: "Export to Excel (CSV)", href: "/pm/export", download: true }]} />
      </PageHeader>
      <PmTabs active="schedules" showChecklists={can(me.role, "manage")} />
      <p className="mb-4 text-sm text-slate-600">
        Each schedule creates a work order when it comes due. To add one, open the equipment and go to its <strong>PM schedules</strong> tab.
      </p>
      <Card>
        {rows.length === 0 ? (
          <Empty>No PM schedules yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>PM</th>
                  <th>Asset</th>
                  <th>Interval</th>
                  <th>Next due</th>
                  <th>Last done</th>
                  <th>Work order</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ task, due, openWorkOrder }) => (
                  <tr key={task.id} className={task.active && task.asset.status === "ACTIVE" ? "" : "opacity-50"}>
                    <td>{due && task.asset.status === "ACTIVE" ? <StatusBadge status={due.status} /> : <span className="text-xs text-slate-500">paused</span>}</td>
                    <td>
                      {can(me.role, "manage") ? (
                        <Link href={`/tasks/${task.id}/edit`} className="link">
                          {task.title}
                        </Link>
                      ) : (
                        task.title
                      )}
                      <div className="text-xs text-slate-500">{userLabel(task.defaultAssignee)}</div>
                    </td>
                    <td>
                      <Link href={`/assets/${task.asset.id}`} className="link">
                        {task.asset.name}
                      </Link>
                    </td>
                    <td className="text-slate-600">{describeInterval(task, task.asset.meterUnit)}</td>
                    <td className="text-sm">{due ? <DueText due={due} meterUnit={task.asset.meterUnit} /> : "—"}</td>
                    <td className="text-slate-600">{formatDate(task.lastDoneAt)}</td>
                    <td className="whitespace-nowrap">
                      {openWorkOrder ? (
                        <Link href={`/work-orders/${openWorkOrder.id}`} className="link">
                          {woNumber(openWorkOrder.number)} →
                        </Link>
                      ) : task.active && task.asset.status === "ACTIVE" ? (
                        <form action={startPmNow.bind(null, task.id)}>
                          <button type="submit" className="link text-sm" title="Create the work order now, before it's due">
                            Start early
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
