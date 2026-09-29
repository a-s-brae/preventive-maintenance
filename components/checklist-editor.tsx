"use client";

import { useState } from "react";
import { CHECKLIST_TYPE_LABEL, CHECKLIST_TYPES, type ChecklistItem, type ChecklistType } from "@/lib/checklist";

type Row = ChecklistItem & { key: number };

let nextKey = 0;
const toRow = (item: ChecklistItem): Row => ({ ...item, key: nextKey++ });

/** Edits a PM checklist. Submits it as JSON in a hidden `checklist` field. */
export function ChecklistEditor({ initial }: { initial: ChecklistItem[] }) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const update = (key: number, patch: Partial<ChecklistItem>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, by: number) =>
    setRows((rs) => {
      const next = [...rs];
      const [row] = next.splice(index, 1);
      next.splice(index + by, 0, row);
      return next;
    });

  const items = rows.map(({ label, type, unit }) => ({ label, type, ...(type === "NUMBER" && unit ? { unit } : {}) }));

  return (
    <div className="space-y-2">
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
            <input
              aria-label={`Unit for item ${i + 1}`}
              value={row.unit ?? ""}
              onChange={(e) => update(row.key, { unit: e.target.value })}
              placeholder="unit"
              className="input w-20"
            />
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
