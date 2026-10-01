import { auth } from "@/auth";
import { csvDate, csvResponse, toCsv } from "@/lib/csv";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response("Sign in first", { status: 401 });
  const assets = await db.asset.findMany({
    orderBy: { name: "asc" },
    include: { location: true, parent: true, downtimes: { where: { endedAt: null }, take: 1 }, _count: { select: { tasks: { where: { active: true } }, workOrders: { where: { status: { not: "COMPLETE" } } } } } },
  });
  const csv = toCsv(
    ["Name", "Asset tag", "Category", "Location", "Parent asset", "Down", "Manufacturer", "Model", "Serial number", "Status", "Meter", "Meter unit", "Meter updated", "Active PM schedules", "Open work orders", "Notes"],
    assets.map((a) => [
      a.name,
      a.assetTag,
      a.category,
      a.location?.name,
      a.parent?.name,
      a.downtimes.length ? "Yes" : "No",
      a.manufacturer,
      a.model,
      a.serialNumber,
      a.status.toLowerCase(),
      a.currentMeter,
      a.meterUnit,
      csvDate(a.meterUpdatedAt),
      a._count.tasks,
      a._count.workOrders,
      a.notes,
    ]),
  );
  return csvResponse(`assets-${csvDate(new Date())}.csv`, csv);
}
