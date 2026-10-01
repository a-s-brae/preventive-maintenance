import { formatValue, type ChecklistResult } from "@/lib/checklist";

export function ChecklistResults({ results }: { results: ChecklistResult[] }) {
  if (results.length === 0) return null;
  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 text-sm">
      {results.map((r, i) => {
        const tone =
          r.value === "FAIL" ? "text-red-700 font-medium" : r.value === "PASS" || r.value === true ? "text-emerald-700" : r.value == null || r.value === false ? "text-slate-400" : "text-slate-900";
        return (
          <li key={i} className="px-4 py-2">
            <div className="flex justify-between gap-4">
              <span>{r.label}</span>
              <span className={`text-right ${tone}`}>{formatValue(r)}</span>
            </div>
            {r.note && <p className="mt-0.5 text-xs text-slate-600">Note: {r.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
