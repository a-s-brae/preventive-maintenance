import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getLocationTree, getOpenWorkOrders } from "@/lib/queries";
import { descendantIds, pathLabel } from "@/lib/tree";
import { OpenWorkOrderList } from "@/components/work-order-table";
import { ButtonLink, Card, DownBadge, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tree = await getLocationTree();
  const node = tree.find((l) => l.id === id);
  if (!node) notFound();
  const inside = [...descendantIds(tree, id)];
  const children = tree.filter((l) => l.parentId === id);
  const [location, assets, open] = await Promise.all([
    db.location.findUnique({ where: { id } }),
    db.asset.findMany({
      where: { locationId: { in: inside }, status: { not: "RETIRED" } },
      orderBy: { name: "asc" },
      include: { location: true, downtimes: { where: { endedAt: null }, take: 1 } },
    }),
    getOpenWorkOrders({ asset: { locationId: { in: inside } } }),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          {node.path.length > 0 && <div className="text-sm text-slate-500">{node.path.join(" › ")}</div>}
          <h1 className="text-2xl font-semibold tracking-tight">{node.name}</h1>
          {location?.notes && <p className="mt-1 max-w-2xl text-sm whitespace-pre-wrap text-slate-600">{location.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/locations/new?parentId=${id}`} variant="secondary">
            + Location inside
          </ButtonLink>
          <ButtonLink href={`/assets/new?locationId=${id}`} variant="secondary">
            + Asset here
          </ButtonLink>
          <ButtonLink href={`/locations/${id}/edit`} variant="secondary">
            Edit
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`Equipment (${assets.length})`}>
            {assets.length === 0 ? (
              <Empty>No equipment here yet.</Empty>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {assets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <Link href={`/assets/${a.id}`} className="link">
                        {a.name}
                      </Link>
                      {a.locationId !== id && <div className="text-xs text-slate-500">{pathLabel(tree.find((l) => l.id === a.locationId))}</div>}
                    </div>
                    {a.downtimes.length ? <DownBadge /> : <span className="text-xs text-emerald-700">Running</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Open work orders">
            <OpenWorkOrderList rows={open} empty="No open work orders here." />
          </Card>
        </div>
        <Card title="Inside this location">
          {children.length === 0 ? (
            <Empty>No sub-locations.</Empty>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {children.map((c) => (
                <li key={c.id}>
                  <Link href={`/locations/${c.id}`} className="link">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
