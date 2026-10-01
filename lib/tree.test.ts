import { expect, it } from "vitest";
import { descendantIds, flattenTree, pathLabel, wouldCycle } from "./tree";

const items = [
  { id: "plant", parentId: null, name: "Plant" },
  { id: "line10", parentId: "molding", name: "Line 10" },
  { id: "line2", parentId: "molding", name: "Line 2" },
  { id: "molding", parentId: "plant", name: "Molding" },
  { id: "office", parentId: null, name: "Office" },
  { id: "orphan", parentId: "gone", name: "Orphan" },
];

it("flattens depth-first with natural name order", () => {
  const flat = flattenTree(items);
  expect(flat.map((n) => `${"-".repeat(n.depth)}${n.name}`)).toEqual(["Office", "Orphan", "Plant", "-Molding", "--Line 2", "--Line 10"]);
  expect(pathLabel(flat.find((n) => n.id === "line2"))).toBe("Plant › Molding › Line 2");
  expect(flat.find((n) => n.id === "molding")?.hasChildren).toBe(true);
});

it("finds descendants and prevents cycles", () => {
  expect([...descendantIds(items, "plant")].sort()).toEqual(["line10", "line2", "molding", "plant"]);
  expect(wouldCycle(items, "plant", "line2")).toBe(true);
  expect(wouldCycle(items, "plant", "plant")).toBe(true);
  expect(wouldCycle(items, "line2", "office")).toBe(false);
  expect(wouldCycle(items, "line2", null)).toBe(false);
});

it("survives cyclic data", () => {
  const bad = [
    { id: "a", parentId: "b", name: "A" },
    { id: "b", parentId: "a", name: "B" },
  ];
  expect(flattenTree(bad)).toEqual([]);
});
