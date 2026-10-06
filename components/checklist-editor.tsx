"use client";

import { useState } from "react";
import { CHECKLIST_TYPE_LABEL, CHECKLIST_TYPES, describeLimits, type ChecklistItem, type ChecklistType } from "@/lib/checklist";

export interface TemplateOption {
  id: string;
  name: string;
  items: ChecklistItem[];
}

// Limits are kept as typed (so "-" or "1." can be on the way to a number).
type Row = Omit<ChecklistItem, "min" | "max"> & { key: number; min: string; max: string };

let nextKey = 0;
const toRow = (item: ChecklistItem): Row => ({ ...item, min: item.min?.toString() ?? "", max: item.max?.toString() ?? "", key: nextKey++ });
const toLimit = (text: string) => (text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : undefined);

/** Edits a PM checklist. Submits it as JSON in a hidden `checklist` field.
 *  With `templates`, a PM can instead use a checklist template: the checklist
 *  then follows the template (sent as `checklistTemplateId`) and isn't edited here. */
export function ChecklistEditor({
  initial,
  templates = [],
  initialTemplateId = null,
}: {
  initial: ChecklistItem[];
  templates?: TemplateOption[];
  initialTemplateId?: string | null;
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const [templateId, setTemplateId] = useState<string | null>(() => (templates.some((t) => t.id === initialTemplateId) ? initialTemplateId : null));
  const template = templates.find((t) => t.id === templateId);
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, by: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });

  const items = rows.map(({ label, type, unit, min, max }) =>
    type === "NUMBER" ? { label, type, ...(unit && { unit }), min: toLimit(min), max: toLimit(max) } : { label, type },
  );

  const picker = templates.length > 0 && (
    <label className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-slate-600">Template:</span>
      <select
        name="checklistTemplateId"
        value={templateId ?? ""}
        onChange={(e) => {
          const next = templates.find((t) => t.id === e.target.value);
          // Leaving a template keeps its items as a starting point for a custom checklist.
          if (!next && template) setRows(template.items.map(toRow));
          setTemplateId(next?.id ?? null);
        }}
        className="input w-auto py-1.5"
      >
        <option value="">None — custom checklist</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.items.length} items)
          </option>
        ))}
      </select>
    </label>
  );

  if (template) {
    return (
      <div className="space-y-2">
        {picker}
        <input type="hidden" name="checklist" value={JSON.stringify(template.items)} />
        <ol className="list-decimal space-y-1 rounded-md border border-slate-200 bg-slate-50 py-2 pr-3 pl-8 text-sm">
          {template.items.map((item, i) => (
            <li key={i}>
              {item.label} <span className="text-xs text-slate-500">· {CHECKLIST_TYPE_LABEL[item.type]}{item.unit ? ` (${item.unit})` : ""}{describeLimits(item) ? ` · OK ${describeLimits(item)}` : ""}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-500">
          Follows the “{template.name}” template: changing the template changes this PM too. Pick “None — custom checklist” to edit it here instead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {picker}
      <input type="hidden" name="checklist" value={JSON.stringify(items)} />
      {rows.length === 0 && <p className="text-sm text-slate-500">No checklist items yet.</p>}
      {rows.map((row, i) => (
        <div key={row.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <input
            aria-label={`Checklist item ${i + 1}`}
            value={row.label}
            onChange={(e) => update(row.key, { label: e.target.value })}
            placeholder="e.g. Check belt tension"
            className="input min-w-0 flex-1 basis-full sm:basis-auto"
          />
          <select
            aria-label={`Type of item ${i + 1}`}
            value={row.type}
            onChange={(e) => update(row.key, { type: e.target.value as ChecklistType })}
            className="input w-auto"
          >
            {CHECKLIST_TYPES.map((t) => (
              <option key={t} value={t}>
                {CHECKLIST_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          {row.type === "NUMBER" && (
            <>
              <input
                aria-label={`Unit for item ${i + 1}`}
                value={row.unit ?? ""}
                onChange={(e) => update(row.key, { unit: e.target.value })}
                placeholder="unit"
                className="input w-20"
              />
              <input
                aria-label={`Lowest OK value for item ${i + 1}`}
                title="Lowest OK reading (optional)"
                inputMode="decimal"
                value={row.min}
                onChange={(e) => update(row.key, { min: e.target.value })}
                placeholder="min"
                className="input w-20"
              />
              <input
                aria-label={`Highest OK value for item ${i + 1}`}
                title="Highest OK reading (optional)"
                inputMode="decimal"
                value={row.max}
                onChange={(e) => update(row.key, { max: e.target.value })}
                placeholder="max"
                className="input w-20"
              />
            </>
          )}
          <div className="flex shrink-0 gap-1">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="btn-icon" aria-label="Move up">
              ↑
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="btn-icon" aria-label="Move down">
              ↓
            </button>
            <button type="button" onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))} className="btn-icon" aria-label="Remove item">
              ✕
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setRows((rs) => [...rs, toRow({ label: "", type: "CHECK" })])} className="btn-secondary">
        + Add item
      </button>
    </div>
  );
}
