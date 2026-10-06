import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { formatMoney, formatQty, stockStatus } from "@/lib/parts";
import { can } from "@/lib/permissions";
import { ButtonLink, Card, Empty, PageHeader, StockBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PartsPage({ searchParams }: { searchParams: Promise<{ q?: string; stock?: string; all?: string }> }) {
  const me = await requirePermission("view");
  const { q: rawQ, stock, all } = await searchParams;
  const q = rawQ?.trim();
  const where: Prisma.PartWhereInput = {
    ...(all ? {} : { active: true }),
    ...(q && {
      OR: (["name", "partNumber", "description", "vendor", "storageLocation"] as const).map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })),
    }),
  };
  const all_ = await db.part.findMany({ where, orderBy: { name: "asc" } });
  const parts = stock === "low" ? all_.filter((p) => stockStatus(p) !== "OK") : all_;
  const value = all_.reduce((sum, p) => sum + Math.max(0, p.quantity) * (p.unitCost ?? 0), 0);
  const lowCount = all_.filter((p) => p.active && stockStatus(p) !== "OK").length;

  const qs = (change: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q, stock, all, ...change }).filter((e): e is [string, string] => !!e[1]));
    return `/parts${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title="Parts">
        <a href="/parts/export" className="btn-secondary" download>
          Export CSV
        </a>
        {can(me.role, "manage") && (
          <ButtonLink href="/parts/import" variant="secondary">
            Import
          </ButtonLink>
        )}
        {can(me.role, "manage") && <ButtonLink href="/parts/new">+ Part</ButtonLink>}
      </PageHeader>
      <form className="mb-3 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, part #, vendor, bin…" className="input w-72" />
        {stock && <input type="hidden" name="stock" value={stock} />}
        <label className="flex items-center gap-2 px-1 text-sm text-slate-600">
          <input type="checkbox" name="all" value="1" defaultChecked={!!all} className="size-4" /> Include retired
        </label>
        <button className="btn-secondary">Search</button>
      </form>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={qs({ stock: stock ? undefined : "low" })}
          aria-pressed={!!stock}
          className={`rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset ${stock ? "bg-amber-500 text-slate-900 ring-amber-500" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}
        >
          Low or out of stock{lowCount ? ` (${lowCount})` : ""}
        </Link>
        <span className="text-xs text-slate-500">Stock value: {formatMoney(value)}</span>
      </div>
      <Card>
        {parts.length === 0 ? (
          <Empty>{all_.length === 0 && !q ? "No parts yet. Add the spares and consumables you keep on hand." : "No parts match."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>On hand</th>
                  <th>Stock</th>
                  <th>Low at</th>
                  <th>Stored at</th>
                  <th>Unit cost</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id} className={p.active ? "" : "opacity-50"}>
                    <td>
                      <Link href={`/parts/${p.id}`} className="link">
                        {p.name}
                      </Link>
                      <div className="text-xs text-slate-500">{[p.partNumber, p.vendor].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="font-medium tabular-nums">
                      {formatQty(p.quantity)} <span className="font-normal text-slate-500">{p.unit}</span>
                    </td>
                    <td>{p.active ? <StockBadge status={stockStatus(p)} /> : <span className="text-xs text-slate-500">retired</span>}</td>
                    <td className="tabular-nums text-slate-600">{p.minQuantity == null ? "—" : formatQty(p.minQuantity)}</td>
                    <td className="text-slate-600">{p.storageLocation ?? "—"}</td>
                    <td className="tabular-nums text-slate-600">{formatMoney(p.unitCost)}</td>
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
