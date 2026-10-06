import { expect, it } from "vitest";
import { matchColumns, missingLocations, parseCsv, planAssetImport, planPartImport, splitPath, summarizePlan } from "./csv-import";
import { toCsv } from "./csv";

it("parses CSV, including our own exports", () => {
  expect(parseCsv('a,b\r\n"x, y","say ""hi"""\n\n1,\n')).toEqual([
    ["a", "b"],
    ["x, y", 'say "hi"'],
    ["1", ""],
  ]);
  expect(parseCsv('a,b\n"two\nlines",z')).toEqual([
    ["a", "b"],
    ["two\nlines", "z"],
  ]);
  // Excel in some regions saves with semicolons
  expect(parseCsv("Name;Qty\nFilter;3")).toEqual([
    ["Name", "Qty"],
    ["Filter", "3"],
  ]);
  // round trip through toCsv (BOM, formula guard)
  const csv = toCsv(["Name", "Notes"], [["Pump", "=SUM(A1)"], ["Fan, big", null]]);
  expect(parseCsv(csv)).toEqual([
    ["Name", "Notes"],
    ["Pump", "=SUM(A1)"],
    ["Fan, big", ""],
  ]);
});

it("matches columns by name, preferring exact names", () => {
  const cols = matchColumns(["Description", "NAME", "Qty", "Mystery"], { name: ["Name", "Description"], quantity: ["On hand", "Qty"] });
  expect(cols).toEqual({ name: 1, quantity: 2 });
  expect(splitPath("Main plant › Compressor room")).toEqual(["Main plant", "Compressor room"]);
  expect(splitPath("Plant 2 > Line 3 / Cell A")).toEqual(["Plant 2", "Line 3", "Cell A"]);
});

const existingAssets = [
  { id: "a1", name: "Air Compressor #1", assetTag: "AC-001", parentId: null, currentMeter: 12000 },
  { id: "a2", name: "Dryer", assetTag: null, parentId: "a1", currentMeter: null },
  { id: "a3", name: "Fan", assetTag: null, parentId: null, currentMeter: null },
  { id: "a4", name: "Fan", assetTag: null, parentId: null, currentMeter: null },
];

it("plans an asset import", () => {
  const plan = planAssetImport(
    parseCsv(
      [
        "Name,Asset tag,Location,Parent asset,Status,Meter,Meter unit,Open work orders,Colour",
        "Air Compressor #1,AC-001,Main plant › Compressor room,,active,12500,hours,2,red", // update, meter up
        "Press 7,PR-007,Main plant > Molding > Line 3,,,,,,", // create, new locations
        "Press 7 chiller,CH-007,Main plant > Molding > Line 3,PR-007,,,,,", // parent from this file
        "Dryer,,,AC-001,,,,,", // matched by name
        "Fan,,,,,,,,", // ambiguous
        ",X-1,,,,,,,", // no name
        "Old mixer,MX-1,,,scrapped,,,,", // bad status
        "Air Compressor #1,AC-001,,,,100,,,", // duplicate tag + meter going backwards
        "Robot,RB-1,,Nowhere,,,,,", // parent not found
      ].join("\n"),
    ),
    existingAssets,
  );
  expect(plan.errors).toEqual([]);
  expect(plan.ignored).toEqual(["Colour"]);
  const by = (line: number) => plan.rows.find((r) => r.line === line)!;
  expect(by(2)).toMatchObject({ action: "update", id: "a1", data: { meter: 12500, locationPath: ["Main plant", "Compressor room"], parent: "" } });
  expect(by(3)).toMatchObject({ action: "create", data: { assetTag: "PR-007", locationPath: ["Main plant", "Molding", "Line 3"] } });
  expect(by(4)).toMatchObject({ action: "create", data: { parent: "PR-007" } });
  expect(by(5)).toMatchObject({ action: "update", id: "a2" });
  expect(by(6).action).toBe("skip");
  expect(by(6).messages[0]).toMatch(/2 assets are called "Fan"/);
  expect(by(7)).toMatchObject({ action: "skip", messages: ["Name is empty"] });
  expect(by(8).messages).toEqual(['Status "scrapped" should be active, inactive or retired']);
  expect(by(9).messages).toEqual(["Asset tag AC-001 is also on line 2", "Meter 100 is below the current reading (12000)"]);
  expect(by(10).messages).toEqual(['Parent asset "Nowhere" not found']);
  expect(summarizePlan(plan)).toEqual({ create: 2, update: 2, skip: 5 });

  const locations = [
    { id: "l1", name: "Main plant", parentId: null },
    { id: "l2", name: "Compressor room", parentId: "l1" },
  ];
  expect(missingLocations(plan, locations)).toEqual([
    ["Main plant", "Molding"],
    ["Main plant", "Molding", "Line 3"],
  ]);
});

it("refuses an asset parent loop", () => {
  const plan = planAssetImport(parseCsv("Name,Asset tag,Parent asset\nAir Compressor #1,AC-001,Dryer"), existingAssets);
  expect(plan.rows[0]).toMatchObject({ action: "skip", messages: ['Parent "Dryer" would put the asset under itself'] });
});

it("needs a header with a Name column", () => {
  expect(planAssetImport(parseCsv("Tag\nAC-1"), []).errors[0]).toMatch(/No "Name" column/);
  expect(planPartImport(parseCsv("Name"), []).errors[0]).toMatch(/no rows/);
});

it("plans a parts import", () => {
  const plan = planPartImport(
    parseCsv(
      [
        "Name,Part number,On hand,Unit,Stock,Low-stock level,Unit cost,Stored at,Vendor,Active",
        "Oil filter,CF-2110,5,ea,OK,2,$24.50,Crib A,Grainger,Yes", // update + count change
        "V-belt B42,VB-42,4,ea,,,12,,,", // new
        "Grease,,1.5,tube,,,,,,no", // new, inactive
        "Bad,BD-1,lots,,,,,,,", // bad number
        "Oil filter again,CF-2110,1,,,,,,,", // duplicate number
      ].join("\n"),
    ),
    [{ id: "p1", name: "Compressor oil filter", partNumber: "CF-2110", quantity: 3 }],
  );
  const by = (line: number) => plan.rows.find((r) => r.line === line)!;
  expect(by(2)).toMatchObject({
    action: "update",
    id: "p1",
    data: { name: "Oil filter", quantity: 5, minQuantity: 2, unitCost: 24.5, storageLocation: "Crib A", active: true },
    messages: ["Note: stock count 3 → 5"],
  });
  expect(by(3)).toMatchObject({ action: "create", data: { partNumber: "VB-42", minQuantity: null, unitCost: 12, storageLocation: null } });
  expect(by(4)).toMatchObject({ action: "create", data: { partNumber: null, quantity: 1.5, unit: "tube", active: false } });
  expect(by(5).messages).toEqual(['On hand "lots" isn\'t a number']);
  expect(by(6).messages).toEqual(["Part number CF-2110 is also on line 2"]);
  expect(plan.ignored).toEqual([]);
});
