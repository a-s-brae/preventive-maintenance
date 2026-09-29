import { describe, expect, it } from "vitest";
import { checklistFromForm, formatValue, parseChecklist, parseResults, resultsFromForm, summarize, type ChecklistItem } from "./checklist";

const items: ChecklistItem[] = [
  { label: "Drain tank", type: "CHECK" },
  { label: "No leaks", type: "PASS_FAIL" },
  { label: "Tank pressure", type: "NUMBER", unit: "psi" },
  { label: "Filter size", type: "TEXT" },
];

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

describe("parseChecklist", () => {
  it("drops invalid entries and blank units", () => {
    expect(parseChecklist([{ label: "A", type: "CHECK" }, { label: "", type: "CHECK" }, { label: "B", type: "BOGUS" }, "x"])).toEqual([
      { label: "A", type: "CHECK" },
    ]);
    expect(parseChecklist([{ label: "P", type: "NUMBER", unit: "" }])).toEqual([{ label: "P", type: "NUMBER" }]);
    expect(parseChecklist(null)).toEqual([]);
  });

  it("keeps results aligned when an entry is invalid", () => {
    expect(parseResults([{ label: "", type: "CHECK", value: true }, { label: "B", type: "CHECK", value: false }])).toEqual([
      { label: "B", type: "CHECK", value: false },
    ]);
  });
});

describe("checklistFromForm", () => {
  it("parses the editor's JSON and skips blank rows", () => {
    expect(checklistFromForm(JSON.stringify([{ label: "A", type: "PASS_FAIL" }, { label: "  ", type: "CHECK" }]))).toEqual([
      { label: "A", type: "PASS_FAIL" },
    ]);
    expect(checklistFromForm(null)).toEqual([]);
  });

  it("returns null for garbage", () => {
    expect(checklistFromForm("{not json")).toBeNull();
  });
});

describe("resultsFromForm", () => {
  it("reads each item type", () => {
    const { results, error } = resultsFromForm(items, form({ "check-0": "on", "check-1": "FAIL", "check-2": "118.5", "check-3": "20x25x1" }));
    expect(error).toBeUndefined();
    expect(results.map((r) => r.value)).toEqual([true, "FAIL", 118.5, "20x25x1"]);
  });

  it("leaves unanswered items empty", () => {
    const { results } = resultsFromForm(items, form({}));
    expect(results.map((r) => r.value)).toEqual([false, null, null, null]);
  });

  it("rejects a non-number reading", () => {
    expect(resultsFromForm(items, form({ "check-2": "abc" })).error).toMatch(/Tank pressure/);
  });

  it("ignores unknown pass/fail values", () => {
    expect(resultsFromForm(items, form({ "check-1": "MAYBE" })).results[1].value).toBeNull();
  });
});

it("summarizes and formats results", () => {
  const { results } = resultsFromForm(items, form({ "check-0": "on", "check-1": "FAIL", "check-2": "90" }));
  expect(summarize(results)).toEqual({ total: 4, answered: 3, failed: 1 });
  expect(results.map(formatValue)).toEqual(["Done", "Fail", "90 psi", "—"]);
});
