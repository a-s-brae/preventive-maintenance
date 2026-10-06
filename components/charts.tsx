// Small, dependency-free charts for the reports page. Server-rendered divs, so
// they print, scale to a phone, and need no JavaScript. Exact numbers are in
// each bar's tooltip and in the table under the charts.

export interface Series {
  key: string;
  label: string;
  /** Tailwind background class. */
  color: string;
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className={`inline-block size-2.5 rounded-sm ${s.color}`} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** A "nice" axis maximum: 1, 2, 5 × 10ⁿ at or above the value. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 5, 10].find((m) => m * p >= v) ?? 10) * p;
}

/** Vertical columns, stacked by series. `max` fixes the scale (e.g. 100 for %). */
export function ColumnChart({
  columns,
  series,
  max,
  format = (v) => String(v),
  emptyText = "Nothing in this range.",
  showZero = false,
}: {
  columns: { label: string; values: Record<string, number | null>; title: string }[];
  series: Series[];
  max?: number;
  format?: (v: number) => string;
  emptyText?: string;
  /** Label columns whose value is 0 (e.g. 0% compliance), as opposed to no value. */
  showZero?: boolean;
}) {
  const totals = columns.map((c) => series.reduce((s, x) => s + (c.values[x.key] ?? 0), 0));
  const top = max ?? niceMax(Math.max(0, ...totals));
  const hasValue = (c: (typeof columns)[number]) => series.some((s) => c.values[s.key] != null && (showZero || c.values[s.key]! > 0));
  if (!columns.some(hasValue)) {
    return <p className="py-10 text-center text-sm text-slate-500">{emptyText}</p>;
  }
  // Keep the axis labels readable when there are many columns.
  const every = Math.ceil(columns.length / 8);
  return (
    <div className="flex gap-2">
      <div className="flex h-40 flex-col justify-between text-right text-[10px] text-slate-400" aria-hidden="true">
        <span>{format(top)}</span>
        <span>{format(top / 2)}</span>
        <span>0</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative flex h-40 items-end gap-[3px] border-b border-slate-300">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-slate-200" />
          <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-200" />
          {columns.map((c, i) => (
            <div key={i} title={c.title} className="relative flex h-full min-w-0 flex-1 flex-col-reverse">
              {series.map((s) => {
                const v = c.values[s.key];
                if (!v) return null;
                return <div key={s.key} className={`${s.color} w-full first:rounded-b-none last:rounded-t-sm`} style={{ height: `${(v / top) * 100}%` }} />;
              })}
              {columns.length <= 16 && hasValue(c) && (
                <span className="absolute inset-x-0 text-center text-[10px] text-slate-500" style={{ bottom: `calc(${(totals[i] / top) * 100}% + 2px)` }}>
                  {format(totals[i])}
                </span>
              )}
            </div>
          ))}
        </div>
        {/* One label per group of `every` columns, spanning the group, so it has room. */}
        <div className="mt-1 flex gap-[3px] text-[10px] text-slate-500">
          {columns
            .filter((_, i) => i % every === 0)
            .map((c, g) => (
              <span key={g} className="min-w-0 truncate" style={{ flex: Math.min(every, columns.length - g * every) }}>
                {c.label}
              </span>
            ))}
        </div>
      </div>
    </div>
  );
}

/** Horizontal bars, one row per item, stacked by series. */
export function BarList({
  rows,
  series,
  format = (v) => String(v),
  emptyText = "Nothing in this range.",
}: {
  rows: { label: string; href?: string; values: Record<string, number> }[];
  series: Series[];
  format?: (v: number) => string;
  emptyText?: string;
}) {
  const totals = rows.map((r) => series.reduce((s, x) => s + (r.values[x.key] ?? 0), 0));
  const top = Math.max(0, ...totals);
  if (top <= 0) return <p className="py-10 text-center text-sm text-slate-500">{emptyText}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) =>
        totals[i] > 0 ? (
          <li key={i} className="text-sm">
            <div className="mb-0.5 flex justify-between gap-3">
              {r.href ? (
                <a href={r.href} className="link truncate">
                  {r.label}
                </a>
              ) : (
                <span className="truncate">{r.label}</span>
              )}
              <span className="shrink-0 text-slate-600 tabular-nums">{format(totals[i])}</span>
            </div>
            <div
              className="flex h-2.5 overflow-hidden rounded-sm bg-slate-100"
              title={series.map((s) => `${s.label}: ${format(r.values[s.key] ?? 0)}`).join(" · ")}
            >
              {series.map((s) => (
                <div key={s.key} className={s.color} style={{ width: `${((r.values[s.key] ?? 0) / top) * 100}%` }} />
              ))}
            </div>
          </li>
        ) : null,
      )}
    </ul>
  );
}
