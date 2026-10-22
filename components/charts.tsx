// Server-rendered charts: plain HTML/SVG that prints, scales to a phone and
// needs no JavaScript. Colours come from the chart tokens in globals.css.

export interface Series {
  key: string;
  label: string;
  /** CSS colour (a chart token, e.g. "var(--color-chart-1)"). */
  color: string;
}

/** Legend for bars: a square swatch per series. */
export function Legend({ series }: { series: Series[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink" aria-label="Legend">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** Horizontal bars, one row per item, stacked by series, the total at the end of the row. */
export function BarList({
  rows,
  series,
  emptyText = "Nothing in this range.",
}: {
  rows: { label: string; href?: string; values: Record<string, number>; display: string; detail?: string }[];
  series: Series[];
  emptyText?: string;
}) {
  const totals = rows.map((r) => series.reduce((s, x) => s + (r.values[x.key] ?? 0), 0));
  const top = Math.max(0, ...totals);
  if (top <= 0) return <p className="py-10 text-center text-sm text-neutral-500">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r, i) =>
        totals[i] > 0 ? (
          <li key={i} className="text-sm">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              {r.href ? (
                <a href={r.href} className="link truncate font-normal">
                  {r.label}
                </a>
              ) : (
                <span className="truncate">{r.label}</span>
              )}
              <span className="shrink-0 text-ink tabular-nums">{r.display}</span>
            </div>
            <div className="flex h-2" title={r.detail}>
              {/* Segments sit side by side with a 2px gap; the bar's end is rounded. */}
              <div className="flex overflow-hidden rounded-r" style={{ width: `${(totals[i] / top) * 100}%` }}>
                {series.map((s) =>
                  r.values[s.key] ? (
                    <div key={s.key} className="h-full border-l-2 border-surface first:border-l-0" style={{ flex: r.values[s.key], background: s.color }} />
                  ) : null,
                )}
              </div>
            </div>
            {r.detail && <div className="sr-only">{r.detail}</div>}
          </li>
        ) : null,
      )}
    </ul>
  );
}

export interface Slice {
  key: string;
  label: string;
  value: number;
  color: string;
  /** A status needs more than colour: a mark beside its label. */
  mark?: "check" | "late" | "cross";
}

const MARK = {
  check: "m4.5 8.5 2.5 2.5 4.5-5.5",
  late: "M8 4.5V8l2.5 1.5",
  cross: "m5 5 6 6m0-6-6 6",
} as const;

/** Part of a whole at a glance: a ring with a gap between slices, the number in the middle,
 *  and a legend with counts and shares (the ring is never the only way to read it). */
export function Donut({ slices, center, centerLabel, emptyText }: { slices: Slice[]; center: string; centerLabel: string; emptyText: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <p className="py-10 text-center text-sm text-neutral-500">{emptyText}</p>;
  const shown = slices.filter((s) => s.value > 0);
  const gap = shown.length > 1 ? 1.2 : 0; // in % of the ring
  let start = 0;
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-5">
      <div className="relative size-36 shrink-0">
        {/* r = 100 / 2π, so the circumference is 100 and dash lengths are percentages. */}
        <svg viewBox="0 0 36 36" className="size-full -rotate-90" aria-hidden="true">
          {shown.map((s) => {
            const pct = (s.value / total) * 100;
            const dash = Math.max(0.01, pct - gap);
            const el = (
              <circle key={s.key} cx="18" cy="18" r="15.9155" fill="none" stroke={s.color} strokeWidth="5" strokeDasharray={`${dash} ${100 - dash}`} strokeDashoffset={-start}>
                <title>{`${s.label}: ${s.value} (${Math.round(pct)}%)`}</title>
              </circle>
            );
            start += pct;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-ink">{center}</span>
          <span className="text-xs text-neutral-500">{centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-44 flex-1 space-y-2.5 text-sm">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span className="flex size-4 shrink-0 items-center justify-center rounded-full" style={{ background: s.color }} aria-hidden="true">
              {s.mark && (
                <svg viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3">
                  <path d={MARK[s.mark]} />
                </svg>
              )}
            </span>
            <span className="flex-1 text-ink">{s.label}</span>
            <span className="text-ink tabular-nums">{s.value}</span>
            <span className="w-10 text-right text-neutral-500 tabular-nums">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
