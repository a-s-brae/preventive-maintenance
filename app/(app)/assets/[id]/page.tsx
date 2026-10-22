import { requirePermission } from "@/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { markAssetDown, markAssetUp, recordMeter, startPmNow } from "@/lib/actions";
import { downtimeHours, formatDateTime, formatDuration, requestNumber } from "@/lib/downtime";
import { formatDate, formatNumber } from "@/lib/forms";
import { getLocationTree, getOpenWorkOrders, getPmSchedules, userLabel, workOrderInclude } from "@/lib/queries";
import { describeInterval } from "@/lib/schedule";
import { pathLabel } from "@/lib/tree";
import { woNumber } from "@/lib/work-orders";
import { can } from "@/lib/permissions";
import { Attachments } from "@/components/attachments";
import { DownForm } from "@/components/down-form";
import { MoreMenu } from "@/components/more-menu";
import { MeterForm } from "@/components/meter-form";
import { CompletedWorkOrderTable, OpenWorkOrderList } from "@/components/work-order-table";
import { ButtonLink, Card, DownBadge, DueText, Empty, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAY_MS = 86_400_000;

export default async function AssetPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const me = await requirePermission("view");
  const canWork = can(me.role, "work");
  const canManage = can(me.role, "manage");
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const asset = await db.asset.findUnique({
    where: { id },
    include: {
      parent: true,
      children: { orderBy: { name: "asc" }, include: { downtimes: { where: { endedAt: null }, take: 1 } } },
      downtimes: {
        orderBy: { startedAt: "desc" },
        take: 200,
        include: { workOrder: true, request: true, startedBy: true, endedBy: true },
      },
      _count: { select: { workOrders: { where: { status: { not: "COMPLETE" } } }, tasks: { where: { active: true } }, attachments: true } },
    },
  });
  if (!asset) notFound();

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "work-orders", label: "Work orders", count: asset._count.workOrders },
    { key: "pm", label: "PM schedules", count: asset._count.tasks },
    { key: "downtime", label: "Downtime" },
    { key: "files", label: "Files", count: asset._count.attachments },
    ...(asset.meterUnit ? [{ key: "meter", label: "Meter" }] : []),
  ];
  const tab = tabs.some((t) => t.key === rawTab) ? rawTab! : "overview";
  const locations = await getLocationTree();
  const location = locations.find((l) => l.id === asset.locationId);
  const openDowntime = asset.downtimes.find((d) => !d.endedAt);
  const now = new Date();

  return (
    <>
      {/* Header */}
      <div className="mb-5">
        <div className="text-sm text-slate-500">
          {location ? (
            <Link href={`/locations/${location.id}`} className="hover:underline">
              {pathLabel(location)}
            </Link>
          ) : (
            "No location"
          )}
          {asset.parent && (
            <>
              {" · part of "}
              <Link href={`/assets/${asset.parent.id}`} className="link">
                {asset.parent.name}
              </Link>
            </>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{asset.name}</h1>
            {openDowntime ? <DownBadge since={`since ${formatDateTime(openDowntime.startedAt)}`} /> : <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Running</span>}
            {asset.status !== "ACTIVE" && <span className="text-xs text-slate-500 uppercase">{asset.status.toLowerCase()}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canWork && !openDowntime && <DownForm action={markAssetDown.bind(null, asset.id)} />}
            <MoreMenu
              items={[
                { label: "Report a problem", href: `/requests/new?assetId=${asset.id}` },
                { label: "Print maintenance history", href: `/print/assets/${asset.id}`, newTab: true },
                { label: "Print QR label", href: `/print/labels?asset=${asset.id}`, newTab: true },
                ...(canManage ? [{ label: "Edit details", href: `/assets/${asset.id}/edit` }] : []),
              ]}
            />
            {canWork && <ButtonLink href={`/work-orders/new?assetId=${asset.id}`}>+ Work order</ButtonLink>}
          </div>
        </div>
      </div>

      {/* Down: the one thing on this page that has to stand out */}
      {openDowntime && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-red-50 px-4 py-3 text-sm ring-1 ring-red-200">
          <div>
            <strong className="text-red-800">Down for {formatDuration(downtimeHours([openDowntime], openDowntime.startedAt, now, now))}</strong>
            {openDowntime.reason && <span className="text-red-800"> — {openDowntime.reason}</span>}
            {openDowntime.workOrder && (
              <>
                {" · "}
                <Link href={`/work-orders/${openDowntime.workOrder.id}`} className="link">
                  {woNumber(openDowntime.workOrder.number)}
                </Link>
              </>
            )}
          </div>
          {canWork && (
            <form action={markAssetUp.bind(null, asset.id)}>
              <button type="submit" className="btn-primary">
                Mark back up
              </button>
            </form>
          )}
        </div>
      )}

      {/* Tabs */}
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 text-sm" aria-label="Asset sections">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.key === "overview" ? `/assets/${asset.id}` : `/assets/${asset.id}?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 whitespace-nowrap ${tab === t.key ? "border-sky-700 font-medium text-sky-800" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {t.label}
            {"count" in t && t.count ? <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-xs text-slate-700">{t.count}</span> : null}
          </Link>
        ))}
      </nav>

      {tab === "overview" && <Overview asset={asset} locationLabel={pathLabel(location)} canManage={canManage} canWork={canWork} />}
      {tab === "work-orders" && <WorkOrdersTab assetId={asset.id} />}
      {tab === "pm" && <PmTab assetId={asset.id} meterUnit={asset.meterUnit} assetActive={asset.status === "ACTIVE"} canManage={canManage} canWork={canWork} />}
      {tab === "downtime" && <DowntimeTab downtimes={asset.downtimes} now={now} />}
      {tab === "meter" && asset.meterUnit && <MeterTab assetId={asset.id} meterUnit={asset.meterUnit} currentMeter={asset.currentMeter} updatedAt={asset.meterUpdatedAt} canWork={canWork} />}
      {tab === "files" && <FilesTab assetId={asset.id} meId={me.id} canWork={canWork} canManage={canManage} />}
    </>
  );
}

type AssetWithRelations = Prisma.AssetGetPayload<{ include: { parent: true; children: { include: { downtimes: true } } } }>;

async function Overview({ asset, locationLabel, canManage, canWork }: { asset: AssetWithRelations; locationLabel: string; canManage: boolean; canWork: boolean }) {
  const open = await getOpenWorkOrders({ assetId: asset.id });
  const details: [string, string | null][] = [
    ["Asset tag", asset.assetTag],
    ["Category", asset.category],
    ["Location", locationLabel || null],
    ["Manufacturer", asset.manufacturer],
    ["Model", asset.model],
    ["Serial number", asset.serialNumber],
    ["Status", asset.status.toLowerCase()],
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card title="Open work orders">
          <OpenWorkOrderList rows={open} showAsset={false} empty="No open work orders." />
        </Card>
        <Card
          title="Sub-assets"
          actions={
            canManage && (
              <ButtonLink href={`/assets/new?parentId=${asset.id}${asset.locationId ? `&locationId=${asset.locationId}` : ""}`} variant="secondary">
                + Sub-asset
              </ButtonLink>
            )
          }
        >
          {asset.children.length === 0 ? (
            <Empty>No sub-assets. Add the parts of this equipment you maintain separately (e.g. a dryer, chiller or robot).</Empty>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {asset.children.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <Link href={`/assets/${c.id}`} className="link">
                    {c.name}
                  </Link>
                  {c.downtimes.length ? <DownBadge /> : <span className="text-xs text-emerald-700">Running</span>}
                </li>
              ))}
            </ul>
          )}
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
            {canWork && <MeterForm action={recordMeter.bind(null, asset.id)} meterUnit={asset.meterUnit} />}
          </Card>
        )}
      </div>
    </div>
  );
}

async function WorkOrdersTab({ assetId }: { assetId: string }) {
  const [open, history] = await Promise.all([
    getOpenWorkOrders({ assetId }),
    db.workOrder.findMany({ where: { assetId, status: "COMPLETE" }, include: workOrderInclude, orderBy: [{ completedAt: "desc" }, { number: "desc" }], take: 100 }),
  ]);
  return (
    <div className="space-y-6">
      <Card title="Open">
        <OpenWorkOrderList rows={open} showAsset={false} empty="No open work orders." />
      </Card>
      <Card title="History">
        <CompletedWorkOrderTable rows={history} showAsset={false} />
      </Card>
    </div>
  );
}

async function PmTab({
  assetId,
  meterUnit,
  assetActive,
  canManage,
  canWork,
}: {
  assetId: string;
  meterUnit: string | null;
  assetActive: boolean;
  canManage: boolean;
  canWork: boolean;
}) {
  const schedules = await getPmSchedules({ assetId });
  return (
    <Card title="PM schedules" actions={canManage && <ButtonLink href={`/assets/${assetId}/tasks/new`}>+ PM schedule</ButtonLink>}>
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
                    {canManage ? (
                      <Link href={`/tasks/${task.id}/edit`} className="link">
                        {task.title}
                      </Link>
                    ) : (
                      task.title
                    )}
                    {Array.isArray(task.checklist) && task.checklist.length > 0 && <div className="text-xs text-slate-500">{task.checklist.length} checklist items</div>}
                  </td>
                  <td className="text-slate-600">{describeInterval(task, meterUnit)}</td>
                  <td className="text-slate-600">{formatDate(task.lastDoneAt)}</td>
                  <td>{due ? <DueText due={due} meterUnit={meterUnit} /> : "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    {openWorkOrder ? (
                      <Link href={`/work-orders/${openWorkOrder.id}`} className="link">
                        {woNumber(openWorkOrder.number)} →
                      </Link>
                    ) : (
                      task.active &&
                      assetActive &&
                      canWork && (
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
  );
}

type DowntimeRow = Prisma.DowntimeGetPayload<{ include: { workOrder: true; request: true; startedBy: true; endedBy: true } }>;

function DowntimeTab({ downtimes, now }: { downtimes: DowntimeRow[]; now: Date }) {
  const since = (days: number) => downtimeHours(downtimes, new Date(now.getTime() - days * DAY_MS), now, now);
  const count = (days: number) => downtimes.filter((d) => (d.endedAt ?? now).getTime() > now.getTime() - days * DAY_MS).length;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        {[7, 30, 90].map((days) => (
          <div key={days} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
            <div className="text-xs text-slate-500 sm:text-sm">Last {days} days</div>
            <div className="text-lg font-semibold tabular-nums sm:text-2xl">{formatDuration(since(days))}</div>
            <div className="text-xs text-slate-500">
              {count(days)} time{count(days) === 1 ? "" : "s"} down
            </div>
          </div>
        ))}
      </div>
      <Card title="Downtime log">
        {downtimes.length === 0 ? (
          <Empty>No downtime logged. Use “Mark down” when it stops, or tick “machine is down” on a request or repair.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Down</th>
                  <th>Back up</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Linked to</th>
                </tr>
              </thead>
              <tbody>
                {downtimes.map((d) => (
                  <tr key={d.id}>
                    <td className="whitespace-nowrap">
                      {formatDateTime(d.startedAt)}
                      <div className="text-xs text-slate-500">{d.startedBy ? userLabel(d.startedBy) : ""}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      {d.endedAt ? formatDateTime(d.endedAt) : <DownBadge since="still down" />}
                      <div className="text-xs text-slate-500">{d.endedBy ? userLabel(d.endedBy) : ""}</div>
                    </td>
                    <td className="tabular-nums">{formatDuration(downtimeHours([d], d.startedAt, d.endedAt ?? now, now))}</td>
                    <td className="max-w-xs text-slate-600">{d.reason ?? "—"}</td>
                    <td className="whitespace-nowrap">
                      {d.workOrder && (
                        <Link href={`/work-orders/${d.workOrder.id}`} className="link">
                          {woNumber(d.workOrder.number)}
                        </Link>
                      )}
                      {d.workOrder && d.request && " · "}
                      {d.request && (
                        <Link href={`/requests/${d.request.id}`} className="link">
                          {requestNumber(d.request.number)}
                        </Link>
                      )}
                      {!d.workOrder && !d.request && "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

async function MeterTab({
  assetId,
  meterUnit,
  currentMeter,
  updatedAt,
  canWork,
}: {
  assetId: string;
  meterUnit: string;
  currentMeter: number | null;
  updatedAt: Date | null;
  canWork: boolean;
}) {
  const readings = await db.meterReading.findMany({ where: { assetId }, orderBy: { recordedAt: "desc" }, take: 100, include: { recordedBy: true } });
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card title="Readings">
        <div className="mb-3">
          <div className="text-2xl font-semibold tabular-nums">
            {formatNumber(currentMeter)} <span className="text-base font-normal text-slate-500">{meterUnit}</span>
          </div>
          <div className="text-xs text-slate-500">Updated {formatDate(updatedAt)}</div>
        </div>
        {canWork && <MeterForm action={recordMeter.bind(null, assetId)} meterUnit={meterUnit} />}
      </Card>
      <div className="lg:col-span-2">
        <Card title="Reading history">
          {readings.length === 0 ? (
            <Empty>No readings yet.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reading</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {readings.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.recordedAt)}</td>
                    <td className="tabular-nums">
                      {formatNumber(r.value)} {meterUnit}
                    </td>
                    <td className="text-slate-600">{r.recordedBy ? userLabel(r.recordedBy) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

async function FilesTab({ assetId, meId, canWork, canManage }: { assetId: string; meId: string; canWork: boolean; canManage: boolean }) {
  const attachments = await db.attachment.findMany({ where: { assetId }, orderBy: { createdAt: "desc" }, include: { uploadedBy: true } });
  return (
    <Card title="Photos & documents">
      <p className="mb-4 text-sm text-slate-600">Manuals, wiring diagrams, nameplate photos — anything you want at hand for this equipment.</p>
      <Attachments
        attachments={attachments}
        target={{ assetId }}
        canUpload={canWork}
        canDelete={(a) => canWork && (a.uploadedById === meId || canManage)}
      />
    </Card>
  );
}
