// Applies a planned CSV import (lib/csv-import.ts) in one transaction: all of
// the planned rows go in, or — if anything fails — none do.
import { db } from "@/lib/db";
import { missingLocations, type AssetImport, type PartImport, type Plan } from "@/lib/csv-import";
import { adjustStock } from "@/lib/parts";
import { flattenTree } from "@/lib/tree";

/** Bulk imports run longer than an everyday save. */
const IMPORT_TX = { maxWait: 10_000, timeout: 120_000 };

const pathKey = (path: string[]) => path.map((p) => p.toLowerCase()).join("\u0000");

export async function runAssetImport(plan: Plan<AssetImport>, userId: string) {
  return db.$transaction(async (tx) => {
    // 1. Locations named in the file that don't exist yet.
    const existingLocations = await tx.location.findMany({ select: { id: true, name: true, parentId: true } });
    const locationIds = new Map(flattenTree(existingLocations).map((l) => [pathKey([...l.path, l.name]), l.id]));
    const toCreate = missingLocations(plan, existingLocations);
    for (const path of toCreate) {
      const parentId = path.length > 1 ? locationIds.get(pathKey(path.slice(0, -1)))! : null;
      const loc = await tx.location.create({ data: { name: path.at(-1)!, parentId } });
      locationIds.set(pathKey(path), loc.id);
    }

    // 2. Assets, without parents (a parent may be created further down the file).
    const ids = new Map<string, string>();
    let created = 0;
    let updated = 0;
    const now = new Date();
    for (const row of plan.rows) {
      if (!row.data || row.action === "skip") continue;
      const { name, assetTag, category, locationPath, manufacturer, model, serialNumber, status, meter, meterUnit, notes } = row.data;
      const fields = {
        name,
        ...(assetTag !== undefined && { assetTag }),
        ...(category !== undefined && { category }),
        ...(locationPath !== undefined && { locationId: locationPath.length ? locationIds.get(pathKey(locationPath))! : null }),
        ...(manufacturer !== undefined && { manufacturer }),
        ...(model !== undefined && { model }),
        ...(serialNumber !== undefined && { serialNumber }),
        ...(status !== undefined && { status }),
        ...(meterUnit !== undefined && { meterUnit }),
        ...(notes !== undefined && { notes }),
        ...(meter !== undefined && { currentMeter: meter, meterUpdatedAt: now }),
      };
      const asset = row.id ? await tx.asset.update({ where: { id: row.id }, data: fields }) : await tx.asset.create({ data: fields });
      if (row.id) updated++;
      else created++;
      ids.set(row.id ?? `new:${row.line}`, asset.id);
      if (meter !== undefined) await tx.meterReading.create({ data: { assetId: asset.id, value: meter, recordedById: userId, recordedAt: now } });
    }

    // 3. Parents.
    for (const row of plan.rows) {
      if (row.action === "skip" || row.data?.parentKey === undefined) continue;
      const id = ids.get(row.id ?? `new:${row.line}`)!;
      const parentId = row.data.parentKey === null ? null : (ids.get(row.data.parentKey) ?? row.data.parentKey);
      await tx.asset.update({ where: { id }, data: { parentId } });
    }
    return { created, updated, locationsCreated: toCreate.length };
  }, IMPORT_TX);
}

export async function runPartImport(plan: Plan<PartImport>, userId: string) {
  return db.$transaction(async (tx) => {
    let created = 0;
    let updated = 0;
    for (const row of plan.rows) {
      if (!row.data || row.action === "skip") continue;
      const { quantity, ...fields } = row.data;
      const part = row.id ? await tx.part.update({ where: { id: row.id }, data: fields }) : await tx.part.create({ data: fields });
      if (row.id) updated++;
      else created++;
      if (quantity != null && quantity !== part.quantity) {
        await adjustStock(tx, {
          partId: part.id,
          reason: "ADJUST",
          setTo: quantity,
          userId,
          note: row.id ? "Count from CSV import" : "Starting stock (CSV import)",
          alert: false,
        });
      }
    }
    return { created, updated, locationsCreated: 0 };
  }, IMPORT_TX);
}
