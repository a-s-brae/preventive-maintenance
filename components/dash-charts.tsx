"use client";

// Charts for the dashboard. Positions are percentages, so they render on the
// server, scale with the card, and need no measuring. Lines keep a 2px stroke
// at any size (non-scaling stroke); dots, labels and the hover readout are HTML
// on top. Every chart can be read without hovering: line charts have a table
// view, columns carry their value on the cap.

import Link from "next/link";
import { useRef, useState } from "react";

export interface LineSeries {
  key: string;
  label: string;
  /** CSS colour (a chart token). */
  color: string;
  values: number[];
  /** Wash under the line (single-series charts). */
  area?: boolean;
}

export interface TrendView {
  key: string;
  label: string;
  /** Says what's plotted when there's one series (it gets no legend). */
  caption?: string;
  series: LineSeries[];
}

/** Clean ticks for counts: 0, step, 2·step… with step 1, 2 or 5 × 10ⁿ. */
function scale(max: number): number[] {
  const rough = Math.max(max, 1) / 4;
  const p = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * p).find((s) => s >= rough)!);
  const ticks = [0];
  while (ticks[ticks.length - 1] < max || ticks.length < 2) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

const compact = (v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}K` : String(v));

/** Smooth path through (i, ys[i]) that never overshoots (monotone cubic). */
function monotonePath(ys: number[]): string {
  const n = ys.length;
  if (n === 1) return `M0,${ys[0]}H1`;
  const d = ys.slice(1).map((y, i) => y - ys[i]);
  const m = ys.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  let path = `M0,${ys[0]}`;
  for (let i = 0; i < n - 1; i++) path += `C${i + 1 / 3},${ys[i] + m[i] / 3} ${i + 2 / 3},${ys[i + 1] - m[i + 1] / 3} ${i + 1},${ys[i + 1]}`;
  return path;
}

/** A trend card: tabs for what to plot, a legend, and a chart / table switch. */
export function TrendCard({ title, labels, titles, views }: { title: string; labels: string[]; titles: string[]; views: TrendView[] }) {
  const [viewKey, setViewKey] = useState(views[0].key);
  const [table, setTable] = useState(false);
  const view = views.find((v) => v.key === viewKey) ?? views[0];
  return (
    <section className="rounded-2xl bg-surface p-5 sm:p-6" aria-label={title}>
      <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <div className="flex gap-4" role="tablist" aria-label={title}>
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={v.key === view.key}
              onClick={() => setViewKey(v.key)}
              className={v.key === view.key ? "font-semibold text-ink" : "text-neutral-500 hover:text-ink"}
            >
              {v.label}
            </button>
          ))}
        </div>
        <span className="hidden h-4 w-px bg-neutral-300 sm:block" aria-hidden="true" />
        {view.series.length > 1 ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink" aria-label="Legend">
            {view.series.map((s) => (
              <li key={s.key} className="flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                {s.label}
              </li>
            ))}
          </ul>
        ) : (
          view.caption && <span className="text-xs text-neutral-500">{view.caption}</span>
        )}
        <button type="button" onClick={() => setTable(!table)} aria-pressed={table} className="ml-auto text-xs text-neutral-500 hover:text-ink">
          {table ? "Show chart" : "Show table"}
        </button>
      </div>
      {table ? (
        <div className="overflow-x-auto">
          <table className="table tabular-nums">
            <thead>
              <tr>
                <th>Week</th>
                {view.series.map((s) => (
                  <th key={s.key} className="text-right">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {titles.map((t, i) => (
                <tr key={t}>
                  <td>{t}</td>
                  {view.series.map((s) => (
                    <td key={s.key} className="text-right">
                      {s.values[i]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <LineChart labels={labels} titles={titles} series={view.series} label={`${title}: ${view.label}`} />
      )}
    </section>
  );
}

/** Lines over time, with a crosshair readout of every series on hover or arrow keys. */
export function LineChart({ labels, titles, series, label }: { labels: string[]; titles: string[]; series: LineSeries[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const n = labels.length;
  // Headroom above the highest point, for its label.
  const ticks = scale(Math.max(0, ...series.flatMap((s) => s.values)) * 1.15);
  const top = ticks[ticks.length - 1];
  const y = (v: number) => 100 - (v / top) * 100;
  const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const pick = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    setActive(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setActive((a) => Math.max(0, Math.min(n - 1, (a ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
    }
  };
  // End labels: the latest value of each series, nudged apart when they'd touch.
  const ends = series.map((s) => ({ s, v: s.values[n - 1], y: y(s.values[n - 1]) })).sort((a, b) => a.y - b.y);
  const close = ends.length === 2 && ends[1].y - ends[0].y < 12;

  return (
    <div className="flex gap-3">
      <div className="relative h-52 w-7 shrink-0 text-right text-xs text-neutral-500 tabular-nums sm:h-60" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
            {compact(t)}
          </span>
        ))}
      </div>
      <div className="@container min-w-0 flex-1">
        <div
          className="relative h-52 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent-300 sm:h-60"
          tabIndex={0}
          role="group"
          aria-label={`${label}. Use the left and right arrow keys to read each week.`}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
        >
          {ticks.map((t) => (
            <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? "border-neutral-300" : "border-chart-grid"}`} style={{ top: `${y(t)}%` }} />
          ))}
          {/* The points sit inset from the grid's ends, so the first and last week's labels fit under them. */}
          <div ref={box} className="absolute inset-y-0 inset-x-4">
            <svg viewBox={`0 0 ${Math.max(1, n - 1)} 100`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
              {series.map((s) => {
                const d = monotonePath(s.values.map(y));
                return (
                  <g key={s.key}>
                    {s.area && <path d={`${d}L${Math.max(1, n - 1)},100L0,100Z`} fill={s.color} fillOpacity={0.1} />}
                    <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                  </g>
                );
              })}
            </svg>
            {active == null &&
              ends.map((e, i) => (
                <span key={e.s.key}>
                  <span
                    className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                    style={{ left: "100%", top: `${e.y}%`, background: e.s.color }}
                  />
                  <span
                    className="pointer-events-none absolute right-1 text-xs font-medium text-ink tabular-nums"
                    style={{ top: `${e.y}%`, transform: `translateY(${close && i === 1 ? "6px" : "calc(-100% - 6px)"})` }}
                  >
                    {e.v}
                  </span>
                </span>
              ))}
            {active != null && (
              <>
                <div className="pointer-events-none absolute inset-y-0 w-px bg-neutral-400" style={{ left: `${x(active)}%` }} />
                {series.map((s) => (
                  <span
                    key={s.key}
                    className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
                    style={{ left: `${x(active)}%`, top: `${y(s.values[active])}%`, background: s.color }}
                  />
                ))}
                <div
                  className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-xl bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-neutral-200"
                  style={{ left: `${x(active)}%`, transform: x(active) > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
                  role="status"
                >
                  <div className="mb-1 text-neutral-500">{titles[active]}</div>
                  {series.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                      <span className="font-semibold text-ink tabular-nums">{s.values[active]}</span>
                      <span className="text-neutral-500">{s.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div className="relative mx-4 mt-2 h-4 text-xs text-neutral-500" aria-hidden="true">
          {labels.map((l, i) => (
            <span
              key={i}
              // Every other label when the chart is narrow, so they don't run together.
              className={`absolute -translate-x-1/2 whitespace-nowrap ${n > 7 && i % 2 ? "hidden @min-[40rem]:block" : ""}`}
              style={{ left: `${x(i)}%` }}
            >
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Columns for a few named things, value on each cap; hover or focus shows the full name. */
export function Columns({
  rows,
  color,
  emptyText,
}: {
  rows: { key: string; label: string; href?: string; value: number; display: string }[];
  color: string;
  emptyText: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const top = Math.max(0, ...rows.map((r) => r.value));
  if (top <= 0) return <p className="py-10 text-center text-sm text-neutral-500">{emptyText}</p>;
  return (
    <div>
      {/* Top padding leaves room for the tallest column's value. */}
      <ul className="flex h-48 gap-2 border-b border-neutral-300 pt-6">
        {rows.map((r) => {
          const pct = (r.value / top) * 100;
          const events = {
            onPointerEnter: () => setActive(r.key),
            onPointerLeave: () => setActive(null),
            onFocus: () => setActive(r.key),
            onBlur: () => setActive(null),
          };
          const content = (
            <>
              <span
                className={`absolute bottom-0 left-1/2 w-full max-w-6 -translate-x-1/2 rounded-t transition-opacity ${active && active !== r.key ? "opacity-50" : ""}`}
                style={{ height: `${pct}%`, minHeight: 2, background: color }}
              />
              <span className="absolute left-1/2 -translate-x-1/2 text-xs font-medium whitespace-nowrap text-ink tabular-nums" style={{ bottom: `calc(${pct}% + 4px)` }}>
                {r.display}
              </span>
              {active === r.key && (
                <span
                  className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 rounded-lg bg-white px-2.5 py-1.5 text-xs whitespace-nowrap shadow-lg ring-1 ring-neutral-200"
                  style={{ bottom: `calc(${pct}% + 24px)` }}
                >
                  <span className="font-semibold text-ink">{r.display}</span> <span className="text-neutral-500">{r.label}</span>
                </span>
              )}
            </>
          );
          const cls = "relative block h-full rounded-t outline-none focus-visible:ring-2 focus-visible:ring-accent-300";
          return (
            <li key={r.key} className="min-w-0 flex-1">
              {r.href ? (
                <Link href={r.href} className={cls} aria-label={`${r.label}: ${r.display}`} {...events}>
                  {content}
                </Link>
              ) : (
                <div className={cls} tabIndex={0} aria-label={`${r.label}: ${r.display}`} {...events}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <ul className="mt-2 flex gap-2 text-xs text-neutral-500" aria-hidden="true">
        {rows.map((r) => (
          <li key={r.key} className="min-w-0 flex-1 truncate text-center" title={r.label}>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ColumnSeries {
  key: string;
  label: string;
  color: string;
}

/** Columns over time, stacked by series, with the total on each cap and a readout on hover or focus. */
export function StackedColumns({
  columns,
  series,
  max,
  suffix = "",
  emptyText,
}: {
  columns: { label: string; title: string; values: Record<string, number | null>; display: string | null }[];
  series: ColumnSeries[];
  /** A fixed top for the scale (100 for percentages). */
  max?: number;
  /** After tick values, e.g. "%". */
  suffix?: string;
  emptyText: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const totals = columns.map((c) => series.reduce((s, x) => s + (c.values[x.key] ?? 0), 0));
  if (!columns.some((c) => c.display != null)) return <p className="py-10 text-center text-sm text-neutral-500">{emptyText}</p>;
  const ticks = max ? [0, max / 2, max] : scale(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1];
  const y = (v: number) => 100 - (v / top) * 100;
  // One axis label per group of columns, so the labels have room.
  const every = Math.ceil(columns.length / 8);
  const caps = columns.length <= 16;

  return (
    <div className="flex gap-3">
      <div className="relative mt-6 h-40 w-8 shrink-0 text-right text-xs text-neutral-500 tabular-nums" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${y(t)}%` }}>
            {compact(t)}
            {suffix}
          </span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative mt-6 h-40">
          {ticks.map((t) => (
            <div key={t} className={`absolute inset-x-0 border-t ${t === 0 ? "border-neutral-300" : "border-chart-grid"}`} style={{ top: `${y(t)}%` }} />
          ))}
          <ul className="absolute inset-0 flex gap-0.5">
            {columns.map((c, i) => (
              <li key={i} className="h-full min-w-0 flex-1">
                <div
                  tabIndex={c.display == null ? -1 : 0}
                  aria-label={`${c.title}${c.display == null ? "" : `: ${c.display}`}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="relative h-full rounded-t outline-none focus-visible:ring-2 focus-visible:ring-accent-300"
                >
                  {/* The stack: segments bottom-up, a 2px card-coloured gap between them. */}
                  <div
                    className={`absolute bottom-0 left-1/2 flex w-full max-w-6 -translate-x-1/2 flex-col-reverse overflow-hidden rounded-t transition-opacity ${active != null && active !== i ? "opacity-50" : ""}`}
                    style={{ height: `${(totals[i] / top) * 100}%` }}
                  >
                    {series.map((s) => {
                      const v = c.values[s.key];
                      if (!v) return null;
                      return <div key={s.key} className="w-full border-b-2 border-surface first:border-b-0" style={{ height: `${(v / totals[i]) * 100}%`, background: s.color }} />;
                    })}
                  </div>
                  {caps && c.display != null && (
                    <span
                      className={`absolute left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-ink tabular-nums ${columns.length > 8 ? "hidden sm:block" : ""}`}
                      style={{ bottom: `calc(${(totals[i] / top) * 100}% + 3px)` }}
                    >
                      {c.display}
                    </span>
                  )}
                  {active === i && (
                    <div
                      className="pointer-events-none absolute bottom-full z-10 mb-2 min-w-36 rounded-xl bg-white px-3 py-2 text-xs whitespace-nowrap shadow-lg ring-1 ring-neutral-200"
                      style={i / columns.length > 0.6 ? { right: 0 } : { left: 0 }}
                      role="status"
                    >
                      <div className="mb-1 text-neutral-500">{c.title}</div>
                      {c.display == null ? (
                        <div className="text-ink">Nothing due</div>
                      ) : (
                        series.map((s) => (
                          <div key={s.key} className="flex items-center gap-2">
                            <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                            <span className="font-semibold text-ink tabular-nums">{series.length === 1 ? c.display : (c.values[s.key] ?? 0)}</span>
                            <span className="text-neutral-500">{s.label}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-2 flex gap-0.5 text-xs text-neutral-500" aria-hidden="true">
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
