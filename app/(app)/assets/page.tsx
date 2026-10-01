import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { formatNumber } from "@/lib/forms";
import { getLocationTree } from "@/lib/queries";
import { compareDue, computeDue } from "@/lib/schedule";
import { descendantIds, flattenTree } from "@/lib/tree";
import { TreeOptions } from "@/components/tree-select";
import { ButtonLink, Card, DownBadge, Empty, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string; location?: string; down?: string }> }) {
  const { q: rawQ, all, location, down } = await searchParams;
  const q = rawQ?.trim();
  const locations = await getLocationTree();
  const inLocation = location ? [...descendantIds(locations, location)] : null;

  const where: Prisma.AssetWhereInput = {
    ...(all ? {} : { status: { not: "RETIRED" } }),
    ...(inLocation && { locationId: { in: inLocation } }),
    ...(down && { downtimes: { some: { endedAt: null } } }),
    ...(q && {
      OR: [
        ...(["name", "assetTag", "category", "manufacturer", "model", "serialNumber"] as const).map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })),
        { location: { name: { contains: q, mode: "insensitive" } } },
      ],
    }),
  };
  const assets = await db.asset.findMany({
    where,
    include: {
      location: true,
      tasks: { where: { active: true } },
      downtimes: { where: { endedAt: null }, take: 1 },
      _count: { select: { workOrders: { where: { status: { not: "COMPLETE" } } } } },
    },
  });
  // A tree while browsing; a flat list while searching or filtering (parents may be filtered out).
  const flat = !!(q || down);
  const rows = flat
    ? [...assets].sort((a, b) => a.name.localeCompare(b.name)).map((a) => ({ ...a, depth: 0 }))
    : flattenTree(assets);

  const qs = (change: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q, all, location, down, ...change }).filter((e): e is [string, string] => !!e[1]));
    return `/assets${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Assets">
        <a href="/assets/export" className="btn-secondary" download>
          Export CSV
        </a>
        <ButtonLink href={`/assets/new${location ? `?locationId=${location}` : ""}`}>+ Asset</ButtonLink>
      </PageHeader>
      <form className="mb-3 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, tag, model…" className="input w-64" />
        <select name="location" defaultValue={location ?? ""} className="input w-auto max-w-xs">
          <option value="">All locations</option>
          <TreeOptions options={locations} />
        </select>
        {down && <input type="hidden" name="down" value="1" />}
        <label className="flex items-center gap-2 px-1 text-sm text-slate-600">
          <input type="checkbox" name="all" value="1" defaultChecked={!!all} className="size-4" /> Include retired
        </label>
        <button className="btn-secondary">Filter</button>
      </form>
      <div className="mb-4 flex items-center gap-3 text-sm">
        <Link
          href={qs({ down: down ? undefined : "1" })}
          aria-pressed={!!down}
          className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${down ? "bg-red-600 text-white ring-red-600" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}
        >
          Down now
        </Link>
        {(q || location || down || all) && (
          <Link href="/assets" className="link text-xs">
            Clear filters
          </Link>
        )}
      </div>
      <Card>
        {rows.length === 0 ? (
          <Empty>No assets found.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Running?</th>
                  <th>PM status</th>
                  <th>Tag</th>
                  <th>Location</th>
                  <th>Meter</th>
                  <th>Open WOs</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const worst = a.tasks.map((t) => computeDue(t, a.currentMeter)).sort(compareDue)[0];
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="flex items-start" style={{ paddingLeft: `${a.depth * 1.25}rem` }}>
                          {a.depth > 0 && <span className="mr-1.5 text-slate-400">└</span>}
                          <div>
                            <Link href={`/assets/${a.id}`} className="link">
                              {a.name}
                            </Link>
                            {a.category && <div className="text-xs text-slate-500">{a.category}</div>}
                          </div>
                        </div>
                      </td>
                      <td>{a.downtimes.length ? <DownBadge /> : <span className="text-xs text-emerald-700">Running</span>}</td>
                      <td>
                        {a.status !== "ACTIVE" ? (
                          <span className="text-xs text-slate-500">{a.status.toLowerCase()}</span>
                        ) : (
                          <StatusBadge status={worst?.status ?? "NO_SCHEDULE"} />
                        )}
                      </td>
                      <td className="text-slate-600">{a.assetTag ?? "—"}</td>
                      <td className="text-slate-600">
                        {a.location ? (
                          <Link href={`/locations/${a.location.id}`} className="hover:underline">
                            {a.location.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="text-slate-600 tabular-nums">{a.meterUnit ? `${formatNumber(a.currentMeter)} ${a.meterUnit}` : "—"}</td>
                      <td className="tabular-nums">{a._count.workOrders || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          {rows.length} asset{rows.length === 1 ? "" : "s"}
        </p>
      </Card>
    </>
  );
}
