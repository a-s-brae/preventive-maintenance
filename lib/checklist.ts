// Typed checklist items for PM schedules and work orders.
//
//   CHECK      tick when done
//   PASS_FAIL  inspection result: pass / fail / n/a
//   NUMBER     a reading, e.g. a pressure or temperature (optional unit, and
//              optional min / max: a reading outside them counts as a problem)
//   TEXT       a short note, e.g. a filter size used
import { z } from "zod";

export const CHECKLIST_TYPES = ["CHECK", "PASS_FAIL", "NUMBER", "TEXT"] as const;
export type ChecklistType = (typeof CHECKLIST_TYPES)[number];

export const CHECKLIST_TYPE_LABEL: Record<ChecklistType, string> = {
  CHECK: "Checkbox",
  PASS_FAIL: "Pass / fail",
  NUMBER: "Number",
  TEXT: "Text",
};

const itemSchema = z.object({
  label: z.string().trim().min(1).max(300),
  type: z.enum(CHECKLIST_TYPES),
  unit: z.string().trim().max(20).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
});
export type ChecklistItem = z.infer<typeof itemSchema>;

export type PassFail = "PASS" | "FAIL" | "NA";
export type ChecklistValue = boolean | PassFail | number | string | null;
export type ChecklistResult = ChecklistItem & { value: ChecklistValue; note?: string };

export const NOTE_MAX = 1000;

/** Read a stored checklist (Json column). Invalid entries are dropped. */
export function parseChecklist(json: unknown): ChecklistItem[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((raw): ChecklistItem[] => {
    const r = itemSchema.safeParse(raw);
    if (!r.success) return [];
    const { min, max, ...item } = r.data;
    if (item.type !== "NUMBER") return [{ label: item.label, type: item.type }];
    // A min above the max is taken as the two typed the wrong way round.
    const [lo, hi] = min != null && max != null && min > max ? [max, min] : [min, max];
    return [{ ...item, unit: item.unit || undefined, ...(lo != null && { min: lo }), ...(hi != null && { max: hi }) }];
  });
}

/** Where a reading sits against its item's limits. */
export function limitStatus(item: ChecklistItem, value: ChecklistValue | undefined): "LOW" | "HIGH" | null {
  if (item.type !== "NUMBER" || typeof value !== "number") return null;
  if (item.min != null && value < item.min) return "LOW";
  if (item.max != null && value > item.max) return "HIGH";
  return null;
}

/** "80–120 psi", "at least 80 psi", "at most 120 psi"; "" when there are no limits. */
export function describeLimits(item: Pick<ChecklistItem, "min" | "max" | "unit">): string {
  const u = item.unit ? ` ${item.unit}` : "";
  if (item.min != null && item.max != null) return `${item.min}–${item.max}${u}`;
  if (item.min != null) return `at least ${item.min}${u}`;
  if (item.max != null) return `at most ${item.max}${u}`;
  return "";
}

/** Failed checks and readings outside their limits, one line each. */
export function findProblems(results: ChecklistResult[]): string[] {
  return results.flatMap((r) => {
    const out = limitStatus(r, r.value);
    if (r.value !== "FAIL" && !out) return [];
    const what = out ? `${formatValue(r)} — ${out === "HIGH" ? "above" : "below"} ${describeLimits(r)}` : "Fail";
    return [`${r.label}: ${what}${r.note ? ` (${r.note})` : ""}`];
  });
}

export function parseResults(json: unknown): ChecklistResult[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((raw) => {
    const [item] = parseChecklist([raw]);
    if (!item) return [];
    const { value, note } = raw as { value?: ChecklistValue; note?: unknown };
    return [{ ...item, value: value ?? null, ...(typeof note === "string" && note.trim() && { note: note.trim() }) }];
  });
}

/** Read the checklist editor's hidden JSON field from a PM form. */
export function checklistFromForm(raw: FormDataEntryValue | null): ChecklistItem[] | null {
  try {
    const parsed = JSON.parse(typeof raw === "string" && raw ? raw : "[]");
    const items = z.array(z.unknown()).parse(parsed);
    // Blank rows are ignored rather than rejected.
    return parseChecklist(items.filter((i) => typeof i === "object" && i && String((i as ChecklistItem).label ?? "").trim()));
  } catch {
    return null;
  }
}

/** Read one answer as typed into its input. CHECK items send "on" when ticked. */
export function parseAnswer(item: ChecklistItem, raw: FormDataEntryValue | string | null): { value: ChecklistValue } | { error: string } {
  const str = typeof raw === "string" ? raw.trim() : "";
  switch (item.type) {
    case "CHECK":
      return { value: str === "on" || str === "true" };
    case "PASS_FAIL":
      return { value: str === "PASS" || str === "FAIL" || str === "NA" ? str : null };
    case "NUMBER": {
      if (!str) return { value: null };
      const n = Number(str);
      return Number.isFinite(n) ? { value: n } : { error: `"${item.label}" needs a number` };
    }
    case "TEXT":
      return { value: str ? str.slice(0, 1000) : null };
  }
}

/** Collect answers from a completion form: fields are `check-<index>` and `note-<index>`. */
export function resultsFromForm(items: ChecklistItem[], fd: FormData): { results: ChecklistResult[]; error?: string } {
  const results: ChecklistResult[] = [];
  for (const [i, item] of items.entries()) {
    const answer = parseAnswer(item, fd.get(`check-${i}`));
    if ("error" in answer) return { results, error: answer.error };
    const note = String(fd.get(`note-${i}`) ?? "").trim().slice(0, NOTE_MAX);
    results.push({ ...item, value: answer.value, ...(note && { note }) });
  }
  return { results };
}

/** Answers saved so far on an open work order, by item index. The draft is only
 *  trusted if it still lines up with the checklist. */
export function draftAnswers(items: ChecklistItem[], draft: unknown): (Pick<ChecklistResult, "value" | "note"> | undefined)[] {
  const saved = parseResults(draft);
  return items.map((item, i) => (saved[i]?.label === item.label && saved[i]?.type === item.type ? saved[i] : undefined));
}

export interface ChecklistSummary {
  total: number;
  answered: number;
  failed: number;
}

export function summarize(results: ChecklistResult[]): ChecklistSummary {
  return {
    total: results.length,
    answered: results.filter((r) => (r.type === "CHECK" ? r.value === true : r.value != null)).length,
    failed: results.filter((r) => r.value === "FAIL" || limitStatus(r, r.value)).length,
  };
}

export function formatValue(r: ChecklistResult): string {
  if (r.value == null) return "—";
  switch (r.type) {
    case "CHECK":
      return r.value ? "Done" : "Not done";
    case "PASS_FAIL":
      return r.value === "PASS" ? "Pass" : r.value === "FAIL" ? "Fail" : "N/A";
    case "NUMBER":
      return `${r.value}${r.unit ? ` ${r.unit}` : ""}`;
    case "TEXT":
      return String(r.value);
  }
}
