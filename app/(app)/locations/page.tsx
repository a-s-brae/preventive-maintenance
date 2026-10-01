import Link from "next/link";
import { db } from "@/lib/db";
import { getLocationTree } from "@/lib/queries";
import { descendantIds } from "@/lib/tree";
import { ButtonLink, Card, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LocationsPage() {
  const [locations, assets, unplaced] = await Promise.all([
    getLocationTree(),
    db.asset.findMany({ where: { status: { not: "RETIRED" } }, select: { locationId: true, downtimes: { where: { endedAt: null }, select: { id: true }, take: 1 } } }),
    db.asset.count({ where: { status: { not: "RETIRED" }, locationId: null } }),
  ]);
  // Totals include everything below each location.
  const totals = (id: string) => {
    const ids = descendantIds(locations, id);
    const here = assets.filter((a) => a.locationId && ids.has(a.locationId));
    return { assets: here.length, down: here.filter((a) => a.downtimes.length).length };
  };

  return (
    <>
      <PageHeader title="Locations">
        <ButtonLink href="/locations/new">+ Location</ButtonLink>
      </PageHeader>
      <p className="-mt-3 mb-6 text-sm text-slate-600">
        Organize equipment by where it is, e.g. <em>Main plant › Molding › Line 3</em>. Counts include everything inside a location.
      </p>
      <Card>
        {locations.length === 0 ? (
          <Empty>No locations yet. Add your plant or building first, then the areas inside it.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Assets</th>
                  <th>Down now</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {locations.map((l) => {
                  const t = totals(l.id);
                  return (
                    <tr key={l.id}>
                      <td>
                        <div className="flex items-center" style={{ paddingLeft: `${l.depth * 1.25}rem` }}>
                          {l.depth > 0 && <span className="mr-1.5 text-slate-400">└</span>}
                          <Link href={`/locations/${l.id}`} className={`link ${l.depth === 0 ? "font-semibold" : ""}`}>
                            {l.name}
                          </Link>
                        </div>
                      </td>
                      <td className="tabular-nums">
                        {t.assets ? (
                          <Link href={`/assets?location=${l.id}`} className="hover:underline">
                            {t.assets}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{t.down ? <span className="font-medium text-red-700">{t.down} down</span> : <span className="text-slate-400">—</span>}</td>
                      <td className="text-right">
                        <Link href={`/locations/new?parentId=${l.id}`} className="link text-xs whitespace-nowrap">
                          + Inside
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {unplaced > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {unplaced} asset{unplaced === 1 ? " has" : "s have"} no location yet — edit {unplaced === 1 ? "it" : "them"} to place {unplaced === 1 ? "it" : "them"}.
          </p>
        )}
      </Card>
    </>
  );
}
