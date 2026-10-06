import { describe, expect, it } from "vitest";
import { checklistFromForm, describeLimits, findProblems, formatValue, limitStatus, parseChecklist, parseResults, resultsFromForm, summarize, type ChecklistItem, type ChecklistResult } from "./checklist";

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

it("flags readings outside their limits and lists problems", () => {
  const [p] = parseChecklist([{ label: "Tank pressure", type: "NUMBER", unit: "psi", min: 125, max: 90 }]);
  expect(p).toEqual({ label: "Tank pressure", type: "NUMBER", unit: "psi", min: 90, max: 125 }); // swapped back
  expect(parseChecklist([{ label: "Belt", type: "CHECK", min: 1 }])).toEqual([{ label: "Belt", type: "CHECK" }]);
  expect(limitStatus(p, 80)).toBe("LOW");
  expect(limitStatus(p, 125)).toBe(null);
  expect(limitStatus(p, 130)).toBe("HIGH");
  expect(limitStatus(p, null)).toBe(null);
  expect(describeLimits(p)).toBe("90–125 psi");
  expect(describeLimits({ min: 5 })).toBe("at least 5");
  expect(describeLimits({ max: 50, unit: "°F" })).toBe("at most 50 °F");

  const results: ChecklistResult[] = [
    { ...p, value: 140 },
    { label: "No leaks", type: "PASS_FAIL", value: "FAIL", note: "inlet fitting" },
    { label: "Drain", type: "PASS_FAIL", value: "PASS" },
    { label: "Dew point", type: "NUMBER", value: 38, max: 50 },
  ];
  expect(findProblems(results)).toEqual(["Tank pressure: 140 psi — above 90–125 psi", "No leaks: Fail (inlet fitting)"]);
  expect(summarize(results).failed).toBe(2);
});
