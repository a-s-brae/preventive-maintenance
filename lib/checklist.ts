// Typed checklist items for PM schedules and work orders.
//
//   CHECK      tick when done
//   PASS_FAIL  inspection result: pass / fail / n/a
//   NUMBER     a reading, e.g. a pressure or temperature (optional unit)
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
});
export type ChecklistItem = z.infer<typeof itemSchema>;

export type PassFail = "PASS" | "FAIL" | "NA";
export type ChecklistValue = boolean | PassFail | number | string | null;
export type ChecklistResult = ChecklistItem & { value: ChecklistValue };

/** Read a stored checklist (Json column). Invalid entries are dropped. */
export function parseChecklist(json: unknown): ChecklistItem[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((raw) => {
    const r = itemSchema.safeParse(raw);
    return r.success ? [{ ...r.data, unit: r.data.unit || undefined }] : [];
  });
}

export function parseResults(json: unknown): ChecklistResult[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((raw) => {
    const [item] = parseChecklist([raw]);
    return item ? [{ ...item, value: (raw as { value?: ChecklistValue }).value ?? null }] : [];
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

/** Collect answers from a completion form: fields are named `check-<index>`. */
export function resultsFromForm(items: ChecklistItem[], fd: FormData): { results: ChecklistResult[]; error?: string } {
  const results: ChecklistResult[] = [];
  for (const [i, item] of items.entries()) {
    const raw = fd.get(`check-${i}`);
    const str = typeof raw === "string" ? raw.trim() : "";
    let value: ChecklistValue = null;
    switch (item.type) {
      case "CHECK":
        value = raw === "on";
        break;
      case "PASS_FAIL":
        value = str === "PASS" || str === "FAIL" || str === "NA" ? str : null;
        break;
      case "NUMBER":
        if (str) {
          const n = Number(str);
          if (!Number.isFinite(n)) return { results, error: `"${item.label}" needs a number` };
          value = n;
        }
        break;
      case "TEXT":
        value = str ? str.slice(0, 1000) : null;
        break;
    }
    results.push({ ...item, value });
  }
  return { results };
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
    failed: results.filter((r) => r.value === "FAIL").length,
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
