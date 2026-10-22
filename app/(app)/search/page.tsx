import Link from "next/link";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { requestNumber } from "@/lib/downtime";
import { formatQty, stockStatus } from "@/lib/parts";
import { TYPE_LABEL, woNumber } from "@/lib/work-orders";
import { Card, PageHeader, RequestStatusBadge, StockBadge, WoStatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

const TAKE = 20;

/** One search box for work orders, equipment, parts and requests. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await requirePermission("view");
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, 100) ?? "";
  // "WO-0012", "REQ-7" or just "12" also finds by number.
  const digits = q.replace(/^(wo|req)-?/i, "");
  const number = /^\d{1,9}$/.test(digits) ? Number(digits) : null;
  const like = { contains: q, mode: "insensitive" as const };

  const [workOrders, assets, parts, requests] = q
    ? await Promise.all([
        db.workOrder.findMany({
          where: { OR: [{ title: like }, { description: like }, { asset: { name: like } }, ...(number ? [{ number }] : [])] },
          orderBy: { number: "desc" },
          take: TAKE,
          select: { id: true, number: true, title: true, type: true, status: true, asset: { select: { name: true } } },
        }),
        db.asset.findMany({
          where: { OR: [{ name: like }, { assetTag: like }, { serialNumber: like }, { manufacturer: like }, { model: like }, { category: like }] },
          orderBy: { name: "asc" },
          take: TAKE,
          select: { id: true, name: true, assetTag: true, status: true, location: { select: { name: true } } },
        }),
        db.part.findMany({
          where: { OR: [{ name: like }, { partNumber: like }, { vendor: like }, { description: like }, { storageLocation: like }] },
          orderBy: { name: "asc" },
          take: TAKE,
        }),
        db.request.findMany({
          where: { OR: [{ title: like }, { description: like }, ...(number ? [{ number }] : [])] },
          orderBy: { createdAt: "desc" },
          take: TAKE,
          select: { id: true, number: true, title: true, status: true, asset: { select: { name: true } } },
        }),
      ])
    : [[], [], [], []];
  // Open work first: that's usually what you're after.
  workOrders.sort((a, b) => Number(a.status === "COMPLETE") - Number(b.status === "COMPLETE"));
  const total = workOrders.length + assets.length + parts.length + requests.length;

  return (
    <>
      <PageHeader title="Search" />
      <form role="search" className="mb-6 max-w-xl">
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus={!q}
          placeholder="Work order, equipment, part or request…"
          aria-label="Search work orders, equipment, parts and requests"
          className="input py-2.5"
        />
      </form>

      {!q ? (
        <p className="text-sm text-neutral-500">Search by name, description, asset tag, serial or part number — or a number like WO-0012.</p>
      ) : total === 0 ? (
        <p className="text-sm text-neutral-500">Nothing matches “{q}”.</p>
      ) : (
        <div className="grid gap-6 @4xl:grid-cols-2">
          {workOrders.length > 0 && (
            <Results title="Work orders" count={workOrders.length}>
              {workOrders.map((wo) => (
                <Row
                  key={wo.id}
                  href={`/work-orders/${wo.id}`}
                  title={wo.title}
                  meta={`${woNumber(wo.number)} · ${TYPE_LABEL[wo.type]} · ${wo.asset.name}`}
                  status={<WoStatusBadge status={wo.status} />}
                />
              ))}
            </Results>
          )}
          {assets.length > 0 && (
            <Results title="Equipment" count={assets.length}>
              {assets.map((a) => (
                <Row
                  key={a.id}
                  href={`/assets/${a.id}`}
                  title={a.name}
                  meta={[a.assetTag, a.location?.name].filter(Boolean).join(" · ") || "No tag or location"}
                  status={a.status === "RETIRED" ? <span className="text-xs text-neutral-500">Retired</span> : null}
                />
              ))}
            </Results>
          )}
          {parts.length > 0 && (
            <Results title="Parts" count={parts.length}>
              {parts.map((p) => (
                <Row
                  key={p.id}
                  href={`/parts/${p.id}`}
                  title={p.name}
                  meta={[p.partNumber, `${formatQty(p.quantity)} ${p.unit} on hand`, p.storageLocation].filter(Boolean).join(" · ")}
                  status={p.active ? <StockBadge status={stockStatus(p)} /> : <span className="text-xs text-neutral-500">Not stocked</span>}
                />
              ))}
            </Results>
          )}
          {requests.length > 0 && (
            <Results title="Requests" count={requests.length}>
              {requests.map((r) => (
                <Row
                  key={r.id}
                  href={`/requests/${r.id}`}
                  title={r.title}
                  meta={[requestNumber(r.number), r.asset?.name].filter(Boolean).join(" · ")}
                  status={<RequestStatusBadge status={r.status} />}
                />
              ))}
            </Results>
          )}
        </div>
      )}
    </>
  );
}

function Results({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <Card title={`${title} · ${count === TAKE ? `first ${TAKE}` : count}`}>
      <ul className="-my-2 divide-y divide-neutral-200/70">{children}</ul>
    </Card>
  );
}

function Row({ href, title, meta, status }: { href: string; title: string; meta: string; status: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <Link href={href} className="link block truncate">
          {title}
        </Link>
        <div className="truncate text-xs text-neutral-500">{meta}</div>
      </div>
      {status}
    </li>
  );
}
