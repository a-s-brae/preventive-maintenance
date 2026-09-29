import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { compareDue, computeDue } from "@/lib/schedule";
import { formatNumber } from "@/lib/forms";
import { ButtonLink, Card, Empty, PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ q?: string; all?: string }> }) {
  const { q, all } = await searchParams;
  const where: Prisma.AssetWhereInput = {
    ...(all ? {} : { status: { not: "RETIRED" } }),
    ...(q
      ? {
          OR: ["name", "assetTag", "category", "location", "manufacturer", "model", "serialNumber"].map((f) => ({
            [f]: { contains: q, mode: "insensitive" },
          })),
        }
      : {}),
  };
  const assets = await db.asset.findMany({
    where,
    orderBy: [{ name: "asc" }],
    include: { tasks: { where: { active: true } } },
  });

  return (
    <>
      <PageHeader title="Assets">
        <ButtonLink href="/assets/new">Add asset</ButtonLink>
      </PageHeader>
      <form className="mb-4 flex flex-wrap items-center gap-3">
        <input name="q" defaultValue={q} placeholder="Search name, tag, location…" className="input max-w-xs" />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="all" value="1" defaultChecked={!!all} className="size-4" /> Include retired
        </label>
        <button className="btn-secondary">Search</button>
      </form>
      <Card>
        {assets.length === 0 ? (
          <Empty>No assets found.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>PM status</th>
                  <th>Asset</th>
                  <th>Tag</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Meter</th>
                  <th>PM tasks</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => {
                  const worst = a.tasks.map((t) => computeDue(t, a.currentMeter)).sort(compareDue)[0];
                  return (
                    <tr key={a.id}>
                      <td>
                        {a.status !== "ACTIVE" ? (
                          <span className="text-xs text-slate-500">{a.status.toLowerCase()}</span>
                        ) : (
                          <StatusBadge status={worst?.status ?? "NO_SCHEDULE"} />
                        )}
                      </td>
                      <td>
                        <Link href={`/assets/${a.id}`} className="link">
                          {a.name}
                        </Link>
                      </td>
                      <td className="text-slate-600">{a.assetTag ?? "—"}</td>
                      <td className="text-slate-600">{a.category ?? "—"}</td>
                      <td className="text-slate-600">{a.location ?? "—"}</td>
                      <td className="text-slate-600 tabular-nums">
                        {a.meterUnit ? `${formatNumber(a.currentMeter)} ${a.meterUnit}` : "—"}
                      </td>
                      <td className="tabular-nums">{a.tasks.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
