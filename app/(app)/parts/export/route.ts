import { auth, type SessionUser } from "@/auth";
import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { stockStatus } from "@/lib/parts";
import { can } from "@/lib/permissions";

const STATUS = { OUT: "Out", LOW: "Low", OK: "OK" } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Sign in first", { status: 401 });
  if (!can((session.user as SessionUser).role, "view")) return new Response("Not allowed", { status: 403 });
  const parts = await db.part.findMany({ orderBy: { name: "asc" } });
  const csv = toCsv(
    ["Name", "Part number", "On hand", "Unit", "Stock", "Low-stock level", "Unit cost", "Stock value", "Stored at", "Vendor", "Active"],
    parts.map((p) => [
      p.name,
      p.partNumber,
      p.quantity,
      p.unit,
      STATUS[stockStatus(p)],
      p.minQuantity,
      p.unitCost,
      p.unitCost == null ? null : Math.round(Math.max(0, p.quantity) * p.unitCost * 100) / 100,
      p.storageLocation,
      p.vendor,
      p.active ? "Yes" : "No",
    ]),
  );
  return csvResponse(`parts-${csvDate(new Date())}.csv`, csv);
}
