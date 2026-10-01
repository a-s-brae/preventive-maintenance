// Asset downtime: an asset is "down" while it has an open Downtime record.
import type { Downtime, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

const HOUR_MS = 3_600_000;

/** Mark an asset down. If it's already down, the open downtime is kept (and
 *  linked to the work order / request if it wasn't linked yet). */
export async function startDowntime(
  db: Db,
  opts: { assetId: string; userId: string | null; reason?: string | null; workOrderId?: string; requestId?: string; at?: Date },
): Promise<Downtime> {
  await db.downtime.createMany({
    data: [
      {
        assetId: opts.assetId,
        openForAssetId: opts.assetId,
        startedAt: opts.at ?? new Date(),
        reason: opts.reason ?? null,
        workOrderId: opts.workOrderId ?? null,
        requestId: opts.requestId ?? null,
        startedById: opts.userId,
      },
    ],
    skipDuplicates: true,
  });
  const open = await db.downtime.findUniqueOrThrow({ where: { openForAssetId: opts.assetId } });
  const link: Prisma.DowntimeUpdateInput = {};
  if (opts.workOrderId && !open.workOrderId) link.workOrder = { connect: { id: opts.workOrderId } };
  if (opts.requestId && !open.requestId) link.request = { connect: { id: opts.requestId } };
  return Object.keys(link).length ? db.downtime.update({ where: { id: open.id }, data: link }) : open;
}

/** Mark an asset back up. Returns the closed downtime, or null if it wasn't down. */
export async function endDowntime(db: Db, assetId: string, userId: string | null, at: Date = new Date()): Promise<Downtime | null> {
  const open = await db.downtime.findUnique({ where: { openForAssetId: assetId } });
  if (!open) return null;
  return db.downtime.update({
    where: { id: open.id },
    // Never end before it started (e.g. a back-dated completion).
    data: { endedAt: at < open.startedAt ? open.startedAt : at, openForAssetId: null, endedById: userId },
  });
}

/** Hours of downtime inside [from, to], counting open downtime up to `now`. */
export function downtimeHours(periods: Pick<Downtime, "startedAt" | "endedAt">[], from: Date, to: Date, now: Date = new Date()): number {
  let ms = 0;
  for (const p of periods) {
    const start = Math.max(p.startedAt.getTime(), from.getTime());
    const end = Math.min((p.endedAt ?? now).getTime(), to.getTime());
    if (end > start) ms += end - start;
  }
  return ms / HOUR_MS;
}

/** "3 h 20 min", "2 d 4 h", "45 min". */
export function formatDuration(hours: number): string {
  const totalMin = Math.round(hours * 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export const requestNumber = (n: number) => `REQ-${String(n).padStart(4, "0")}`;
