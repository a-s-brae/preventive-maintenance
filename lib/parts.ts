// Parts and stock. Stock only changes through adjustStock(), which locks the
// part's row and records a StockTransaction, so counts can't drift under
// concurrent use and every change has a history line.
import type { Part, Prisma, StockReason } from "@prisma/client";
import { adminIds, notify, type Notice } from "@/lib/notify";

export type StockStatus = "OUT" | "LOW" | "OK";

export function stockStatus(part: Pick<Part, "quantity" | "minQuantity">): StockStatus {
  if (part.quantity <= 0) return "OUT";
  if (part.minQuantity != null && part.quantity <= part.minQuantity) return "LOW";
  return "OK";
}

export class StockError extends Error {}

/** Change a part's stock by `change` (or set it to `setTo` for a count). */
export async function adjustStock(
  tx: Prisma.TransactionClient,
  opts: {
    partId: string;
    reason: StockReason;
    change?: number;
    setTo?: number;
    userId: string | null;
    workOrderId?: string | null;
    unitCost?: number | null;
    note?: string | null;
    /** Tell admins when this takes the part low (default). Off for bulk imports. */
    alert?: boolean;
  },
): Promise<Part> {
  await tx.$queryRaw`SELECT id FROM "Part" WHERE id = ${opts.partId} FOR UPDATE`;
  const part = await tx.part.findUniqueOrThrow({ where: { id: opts.partId } });
  const after = roundQty(opts.setTo ?? part.quantity + (opts.change ?? 0));
  const change = roundQty(after - part.quantity);
  if (opts.reason === "USED" && after < 0) {
    throw new StockError(`Only ${formatQty(part.quantity)} ${part.unit} of ${part.name} in stock — restock or correct the count first`);
  }
  const updated = await tx.part.update({
    where: { id: part.id },
    data: { quantity: after, ...(opts.reason === "RESTOCK" && opts.unitCost != null && { unitCost: opts.unitCost }) },
  });
  await tx.stockTransaction.create({
    data: {
      partId: part.id,
      change,
      quantityAfter: after,
      reason: opts.reason,
      unitCost: opts.unitCost ?? part.unitCost,
      workOrderId: opts.workOrderId ?? null,
      note: opts.note ?? null,
      userId: opts.userId,
    },
  });
  const alert = opts.alert === false ? null : stockAlert(part, updated);
  if (alert) await notify(tx, await adminIds(tx), alert, opts.userId);
  return updated;
}

/** A stock change that takes a part from OK to low or out, worth telling admins about. */
export function stockAlert(
  before: { quantity: number; minQuantity: number | null },
  after: { id: string; name: string; unit: string; quantity: number; minQuantity: number | null },
): Notice | null {
  const was = stockStatus(before);
  const now = stockStatus(after);
  if (now === "OK" || now === was || (was === "OUT" && now === "LOW")) return null;
  return {
    title: now === "OUT" ? `Out of stock: ${after.name}` : `Low stock: ${after.name}`,
    body: `${after.quantity} ${after.unit} left${after.minQuantity != null ? ` (reorder at ${after.minQuantity})` : ""}`,
    href: `/parts/${after.id}`,
  };
}


/** Quantities are kept to 3 decimals (feet, quarts…) to avoid float dust. */
export const roundQty = (n: number) => Math.round(n * 1000) / 1000;

export const formatQty = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 3 });

export const formatMoney = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const STOCK_REASON_LABEL: Record<StockReason, string> = {
  RESTOCK: "Restocked",
  USED: "Used",
  RETURNED: "Returned",
  ADJUST: "Count corrected",
};

/** Total cost of parts used, from each line's quantity × unit cost at the time. */
export function partsCost(usages: { quantity: number; unitCost: number | null }[]): number {
  return usages.reduce((sum, u) => sum + u.quantity * (u.unitCost ?? 0), 0);
}
