// Bulk import of assets and parts from a spreadsheet (CSV). Pure: parsing,
// matching columns and planning what each row will do. lib/import-run.ts
// applies a plan to the database.
//
// The columns are the same as the Export CSV files, so the easiest way to
// bulk-edit is: export, change in Excel, import. Columns are matched by name
// (any order, case and spacing ignored); unknown columns are ignored.
import { flattenTree, wouldCycle } from "@/lib/tree";

export const MAX_IMPORT_ROWS = 2000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

// ─── CSV ─────────────────────────────────────────────────────────────────────

/** Parse CSV text (RFC 4180: quoted fields, "" escapes, newlines in quotes).
 *  Handles a BOM, CRLF, and comma, semicolon or tab separators. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.slice(0, src.search(/\r?\n|$/));
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const sep = [",", ";", "\t"].reduce((best, ch) => (count(ch) > count(best) ? ch : best), ",");

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Undo the export's formula guard ('=…) and drop blank lines.
  return rows
    .map((r) => r.map((v) => (/^'[=+\-@]/.test(v) ? v.slice(1) : v).trim()))
    .filter((r) => r.some((v) => v !== ""));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Map each known field to its column index, using the header row. */
export function matchColumns<F extends string>(header: string[], aliases: Record<F, string[]>): Partial<Record<F, number>> {
  const out: Partial<Record<F, number>> = {};
  const used = new Set<number>();
  // Each field's own name first (so "Name" wins over an alias elsewhere), then aliases.
  for (const exact of [true, false]) {
    for (const [field, names] of Object.entries(aliases) as [F, string[]][]) {
      if (out[field] !== undefined) continue;
      const i = header.findIndex((h, j) => !used.has(j) && (exact ? [names[0]] : names).some((a) => norm(a) === norm(h)));
      if (i >= 0) {
        out[field] = i;
        used.add(i);
      }
    }
  }
  return out;
}

// ─── Plans ───────────────────────────────────────────────────────────────────

export type RowAction = "create" | "update" | "skip";

export interface PlannedRow<D> {
  /** Line in the file (the header is line 1). */
  line: number;
  name: string;
  action: RowAction;
  /** Set for create / update. */
  data?: D;
  /** Existing record to update. */
  id?: string;
  /** Why a row is skipped, or things worth knowing about it. */
  messages: string[];
}

export interface Plan<D> {
  rows: PlannedRow<D>[];
  /** Problems with the file as a whole (no header, missing Name column…). */
  errors: string[];
  /** Columns that were recognised, for the preview. */
  columns: string[];
  /** Header cells that weren't recognised (ignored). */
  ignored: string[];
}

function readNumber(raw: string | undefined, label: string, messages: string[]): number | null | undefined {
  if (raw === undefined || raw === "") return undefined;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    messages.push(`${label} "${raw}" isn't a number`);
    return null;
  }
  return n;
}

function readYesNo(raw: string | undefined): boolean | undefined {
  if (raw === undefined || raw === "") return undefined;
  return !/^(no|n|false|0|inactive)$/i.test(raw);
}

function startPlan<F extends string>(
  table: string[][],
  aliases: Record<F, string[]>,
  readOnly: string[],
): { cols: Partial<Record<F, number>>; body: string[][]; plan: Plan<never> } {
  const plan: Plan<never> = { rows: [], errors: [], columns: [], ignored: [] };
  if (table.length < 2) {
    plan.errors.push("The file has no rows to import — it needs a header row and at least one row below it.");
    return { cols: {}, body: [], plan };
  }
  if (table.length - 1 > MAX_IMPORT_ROWS) plan.errors.push(`The file has ${table.length - 1} rows; import at most ${MAX_IMPORT_ROWS} at a time.`);
  const [header, ...body] = table;
  const cols = matchColumns(header, aliases);
  if (cols["name" as F] === undefined) plan.errors.push(`No "Name" column found. The first row must be the column names, e.g. ${Object.values<string[]>(aliases).map((a) => a[0]).slice(0, 4).join(", ")}.`);
  plan.columns = header.filter((_, i) => Object.values(cols).includes(i));
  plan.ignored = header.filter((h, i) => h && !Object.values(cols).includes(i) && !readOnly.some((r) => norm(r) === norm(h)));
  return { cols, body, plan };
}

// ─── Assets ──────────────────────────────────────────────────────────────────

export const ASSET_COLUMNS = {
  name: ["Name", "Asset", "Asset name", "Equipment"],
  assetTag: ["Asset tag", "Tag", "Asset number", "Asset #", "Equipment number"],
  category: ["Category", "Type"],
  location: ["Location", "Area"],
  parent: ["Parent asset", "Parent"],
  manufacturer: ["Manufacturer", "Make", "Brand"],
  model: ["Model"],
  serialNumber: ["Serial number", "Serial", "Serial #", "S/N"],
  status: ["Status"],
  meter: ["Meter", "Meter reading", "Hours"],
  meterUnit: ["Meter unit", "Unit"],
  notes: ["Notes", "Description"],
};
/** Export columns that are reports, not settings — not imported, not flagged. */
const ASSET_READ_ONLY = ["Down", "Meter updated", "Active PM schedules", "Open work orders"];

export interface AssetImport {
  name: string;
  assetTag?: string | null;
  category?: string | null;
  /** Location path, e.g. ["Main plant", "Compressor room"]; [] = none. */
  locationPath?: string[];
  /** Parent, by tag or name, as written. "" = none. */
  parent?: string;
  /** The parent found: an existing asset id, or "new:<line>" for one created by this import. */
  parentKey?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status?: "ACTIVE" | "INACTIVE" | "RETIRED";
  meter?: number;
  meterUnit?: string | null;
  notes?: string | null;
}

interface ExistingAsset {
  id: string;
  name: string;
  assetTag: string | null;
  parentId: string | null;
  currentMeter: number | null;
}

/** A location path as written: "Main plant › Compressor room", "Main plant > Line 3", "Main plant / Line 3". */
export const splitPath = (s: string) =>
  s
    .split(/\s*(?:›|>|\/|\\)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

export function planAssetImport(table: string[][], existing: ExistingAsset[]): Plan<AssetImport> {
  const { cols, body, plan } = startPlan(table, ASSET_COLUMNS, ASSET_READ_ONLY);
  const out = plan as Plan<AssetImport>;
  if (out.errors.length) return out;

  const byTag = new Map(existing.filter((a) => a.assetTag).map((a) => [a.assetTag!.toLowerCase(), a]));
  const byName = new Map<string, ExistingAsset[]>();
  for (const a of existing) byName.set(a.name.toLowerCase(), [...(byName.get(a.name.toLowerCase()) ?? []), a]);
  const seenTags = new Map<string, number>();

  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (f: keyof typeof ASSET_COLUMNS) => (cols[f] === undefined ? undefined : (cells[cols[f]!] ?? ""));
    const messages: string[] = [];
    const name = get("name") ?? "";
    const tag = get("assetTag");
    if (!name) return out.rows.push({ line, name: tag || "(no name)", action: "skip", messages: ["Name is empty"] });
    if (name.length > 200) messages.push("Name is longer than 200 characters");
    if (tag) {
      const first = seenTags.get(tag.toLowerCase());
      if (first) messages.push(`Asset tag ${tag} is also on line ${first}`);
      else seenTags.set(tag.toLowerCase(), line);
    }

    const opt = (f: keyof typeof ASSET_COLUMNS) => {
      const v = get(f);
      return v === undefined ? undefined : v || null;
    };
    const data: AssetImport = { name: name.slice(0, 200) };
    if (tag !== undefined) data.assetTag = tag || null;
    for (const f of ["category", "manufacturer", "model", "serialNumber", "meterUnit", "notes"] as const) {
      const v = opt(f);
      if (v !== undefined) data[f] = v;
    }
    const loc = get("location");
    if (loc !== undefined) data.locationPath = splitPath(loc);
    const parent = get("parent");
    if (parent !== undefined) data.parent = parent;
    const status = get("status");
    if (status) {
      const s = status.toUpperCase();
      if (s === "ACTIVE" || s === "INACTIVE" || s === "RETIRED") data.status = s;
      else messages.push(`Status "${status}" should be active, inactive or retired`);
    }
    const meter = readNumber(get("meter"), "Meter", messages);

    // Match: by tag, else by name (when the name is unique).
    let match: ExistingAsset | undefined;
    if (tag) match = byTag.get(tag.toLowerCase());
    else {
      const same = byName.get(name.toLowerCase()) ?? [];
      if (same.length === 1) match = same[0];
      else if (same.length > 1) messages.push(`${same.length} assets are called "${name}" — add an Asset tag column to say which one`);
    }
    if (meter != null) {
      if (match?.currentMeter != null && meter < match.currentMeter) messages.push(`Meter ${meter} is below the current reading (${match.currentMeter})`);
      else if (match?.currentMeter !== meter) data.meter = meter;
    }

    const errors = messages.filter((m) => !m.startsWith("Note:"));
    if (errors.length) return out.rows.push({ line, name, action: "skip", messages });
    out.rows.push({ line, name, action: match ? "update" : "create", id: match?.id, data, messages });
  });

  // Parents: must name an asset that exists or is in this file, and not loop.
  const finalAssets = new Map(existing.map((a) => [a.id, { id: a.id, name: a.name, parentId: a.parentId }]));
  const keyFor = (r: PlannedRow<AssetImport>) => r.id ?? `new:${r.line}`;
  const findParent = (ref: string): string | null | "ambiguous" => {
    const l = ref.toLowerCase();
    const inFile = out.rows.filter((r) => r.data && (r.data.assetTag?.toLowerCase() === l || r.data.name.toLowerCase() === l));
    if (inFile.length === 1) return keyFor(inFile[0]);
    const tagged = byTag.get(l);
    if (tagged) return tagged.id;
    const named = byName.get(l) ?? [];
    if (named.length === 1) return named[0].id;
    return inFile.length + named.length > 1 ? "ambiguous" : null;
  };
  for (const r of out.rows) if (r.data) finalAssets.set(keyFor(r), { id: keyFor(r), name: r.data.name, parentId: finalAssets.get(keyFor(r))?.parentId ?? null });
  for (const r of out.rows) {
    if (r.data?.parent === "") {
      finalAssets.get(keyFor(r))!.parentId = null;
      r.data.parentKey = null;
    }
    if (!r.data?.parent) continue;
    const p = findParent(r.data.parent);
    if (p === null || p === "ambiguous") {
      r.messages.push(p === null ? `Parent asset "${r.data.parent}" not found` : `More than one asset matches parent "${r.data.parent}" — use its asset tag`);
      r.action = "skip";
      continue;
    }
    const all = [...finalAssets.values()];
    if (wouldCycle(all, keyFor(r), p)) {
      r.messages.push(`Parent "${r.data.parent}" would put the asset under itself`);
      r.action = "skip";
      continue;
    }
    finalAssets.get(keyFor(r))!.parentId = p;
    r.data.parentKey = p;
  }
  for (const r of out.rows) if (r.action === "skip") delete r.data;
  return out;
}

/** Location paths an asset plan needs that don't exist yet, parents first. */
export function missingLocations(plan: Plan<AssetImport>, locations: { id: string; name: string; parentId: string | null }[]): string[][] {
  const known = new Set(flattenTree(locations).map((l) => [...l.path, l.name].map((p) => p.toLowerCase()).join("\u0000")));
  const missing = new Map<string, string[]>();
  for (const r of plan.rows) {
    const path = r.data?.locationPath ?? [];
    for (let d = 1; d <= path.length; d++) {
      const key = path.slice(0, d).map((p) => p.toLowerCase()).join("\u0000");
      if (!known.has(key) && !missing.has(key)) missing.set(key, path.slice(0, d));
    }
  }
  return [...missing.values()].sort((a, b) => a.length - b.length);
}

// ─── Parts ───────────────────────────────────────────────────────────────────

export const PART_COLUMNS = {
  name: ["Name", "Part", "Part name", "Item"],
  partNumber: ["Part number", "Part #", "Part no", "SKU", "Item number"],
  quantity: ["On hand", "Quantity", "Qty", "Stock on hand"],
  unit: ["Unit", "UOM", "Unit of measure"],
  minQuantity: ["Low-stock level", "Min", "Minimum", "Reorder point", "Min quantity"],
  unitCost: ["Unit cost", "Cost", "Price"],
  storageLocation: ["Stored at", "Bin", "Location", "Storage location"],
  vendor: ["Vendor", "Supplier"],
  active: ["Active"],
};
const PART_READ_ONLY = ["Stock", "Stock value"];

export interface PartImport {
  name: string;
  partNumber?: string | null;
  quantity?: number;
  unit?: string;
  minQuantity?: number | null;
  unitCost?: number | null;
  storageLocation?: string | null;
  vendor?: string | null;
  active?: boolean;
}

interface ExistingPart {
  id: string;
  name: string;
  partNumber: string | null;
  quantity: number;
}

export function planPartImport(table: string[][], existing: ExistingPart[]): Plan<PartImport> {
  const { cols, body, plan } = startPlan(table, PART_COLUMNS, PART_READ_ONLY);
  const out = plan as Plan<PartImport>;
  if (out.errors.length) return out;

  const byNumber = new Map(existing.filter((p) => p.partNumber).map((p) => [p.partNumber!.toLowerCase(), p]));
  const byName = new Map<string, ExistingPart[]>();
  for (const p of existing) byName.set(p.name.toLowerCase(), [...(byName.get(p.name.toLowerCase()) ?? []), p]);
  const seen = new Map<string, number>();

  body.forEach((cells, i) => {
    const line = i + 2;
    const get = (f: keyof typeof PART_COLUMNS) => (cols[f] === undefined ? undefined : (cells[cols[f]!] ?? ""));
    const messages: string[] = [];
    const name = get("name") ?? "";
    const number = get("partNumber");
    if (!name) return out.rows.push({ line, name: number || "(no name)", action: "skip", messages: ["Name is empty"] });
    const key = (number || name).toLowerCase();
    const first = seen.get(key);
    if (first) messages.push(`${number ? `Part number ${number}` : `"${name}"`} is also on line ${first}`);
    else seen.set(key, line);

    const data: PartImport = { name: name.slice(0, 200) };
    if (number !== undefined) data.partNumber = number || null;
    const qty = readNumber(get("quantity"), "On hand", messages);
    if (qty != null) data.quantity = qty;
    const unit = get("unit");
    if (unit) data.unit = unit.slice(0, 20);
    const min = readNumber(get("minQuantity"), "Low-stock level", messages);
    if (min !== null) {
      if (min !== undefined) data.minQuantity = min;
      else if (get("minQuantity") === "") data.minQuantity = null;
    }
    const cost = readNumber(get("unitCost"), "Unit cost", messages);
    if (cost !== null) {
      if (cost !== undefined) data.unitCost = cost;
      else if (get("unitCost") === "") data.unitCost = null;
    }
    for (const f of ["storageLocation", "vendor"] as const) {
      const v = get(f);
      if (v !== undefined) data[f] = v || null;
    }
    const active = readYesNo(get("active"));
    if (active !== undefined) data.active = active;

    let match: ExistingPart | undefined;
    if (number) match = byNumber.get(number.toLowerCase());
    else {
      const same = byName.get(name.toLowerCase()) ?? [];
      if (same.length === 1) match = same[0];
      else if (same.length > 1) messages.push(`${same.length} parts are called "${name}" — add a Part number column to say which one`);
    }
    if (messages.length) return out.rows.push({ line, name, action: "skip", messages });
    if (match && data.quantity != null && data.quantity !== match.quantity) {
      messages.push(`Note: stock count ${match.quantity} → ${data.quantity}`);
    }
    out.rows.push({ line, name, action: match ? "update" : "create", id: match?.id, data, messages });
  });
  return out;
}

export function summarizePlan(plan: Plan<unknown>) {
  return {
    create: plan.rows.filter((r) => r.action === "create").length,
    update: plan.rows.filter((r) => r.action === "update").length,
    skip: plan.rows.filter((r) => r.action === "skip").length,
  };
}
