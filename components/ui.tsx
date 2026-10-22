import Link from "next/link";
import type { Priority, WorkOrderStatus } from "@prisma/client";
import type { DueInfo, DueStatus } from "@/lib/schedule";
import { PRIORITY_LABEL, STATUS_LABEL as WO_STATUS_LABEL } from "@/lib/work-orders";
import { formatDate, formatNumber } from "@/lib/forms";

type Tone = "red" | "amber" | "green" | "blue" | "violet" | "grey";

const TONE: Record<Tone, [text: string, dot: string]> = {
  red: ["text-red-700", "bg-red-500"],
  amber: ["text-amber-700", "bg-amber-400"],
  green: ["text-emerald-700", "bg-emerald-500"],
  blue: ["text-accent-700", "bg-accent-500"],
  violet: ["text-violet-700", "bg-violet-500"],
  grey: ["text-neutral-500", "bg-neutral-300"],
};

/** A status: coloured dot plus coloured text (the text says it, the colour helps). */
export function StatusDot({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  const [text, dot] = TONE[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${text}`}>
      <span className={`size-1.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
      {children}
    </span>
  );
}

const DUE: Record<DueStatus, [string, Tone]> = {
  OVERDUE: ["Overdue", "red"],
  DUE_SOON: ["Due soon", "amber"],
  OK: ["OK", "green"],
  NO_SCHEDULE: ["No schedule", "grey"],
};

export function StatusBadge({ status }: { status: DueStatus }) {
  const [label, tone] = DUE[status];
  return <StatusDot tone={tone}>{label}</StatusDot>;
}

const REQUEST_STATUS: Record<"PENDING" | "APPROVED" | "REJECTED", [string, Tone]> = {
  PENDING: ["Waiting for review", "amber"],
  APPROVED: ["Approved", "green"],
  REJECTED: ["Rejected", "grey"],
};

export function RequestStatusBadge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const [label, tone] = REQUEST_STATUS[status];
  return <StatusDot tone={tone}>{label}</StatusDot>;
}

const STOCK: Record<"OUT" | "LOW" | "OK", [string, Tone]> = {
  OUT: ["Out of stock", "red"],
  LOW: ["Low", "amber"],
  OK: ["In stock", "green"],
};

export function StockBadge({ status }: { status: "OUT" | "LOW" | "OK" }) {
  const [label, tone] = STOCK[status];
  return <StatusDot tone={tone}>{label}</StatusDot>;
}

/** Red "Down" pill for equipment with open downtime: the one alarm that stays a pill. */
export function DownBadge({ since }: { since?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-red-700 ring-1 ring-red-200 ring-inset">
      <span className="size-1.5 rounded-full bg-red-500" aria-hidden="true" />
      Down{since ? ` · ${since}` : ""}
    </span>
  );
}

const WO_STATUS_TONE: Record<WorkOrderStatus, Tone> = {
  OPEN: "blue",
  IN_PROGRESS: "violet",
  ON_HOLD: "amber",
  COMPLETE: "green",
};

export function WoStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <StatusDot tone={WO_STATUS_TONE[status]}>{WO_STATUS_LABEL[status]}</StatusDot>;
}

const PRIORITY_STYLE: Record<Priority, string> = {
  NONE: "text-neutral-400",
  LOW: "text-neutral-500",
  MEDIUM: "text-amber-700",
  HIGH: "font-semibold text-red-700",
};

export function PriorityText({ priority }: { priority: Priority }) {
  if (priority === "NONE") return <span className="text-neutral-400">—</span>;
  return <span className={`text-xs whitespace-nowrap ${PRIORITY_STYLE[priority]}`}>{PRIORITY_LABEL[priority]}</span>;
}

/** A work order's due point: "Mar 3, 2026 (in 4 days)" and/or "at 1,250 hours". */
export function WoDueText({
  dueDate,
  dueMeter,
  daysLeft,
  meterLeft = null,
  meterUnit,
}: {
  dueDate: Date | null;
  dueMeter: number | null;
  daysLeft: number | null;
  meterLeft?: number | null;
  meterUnit: string | null;
}) {
  const parts: string[] = [];
  if (dueDate && daysLeft != null) {
    const rel = daysLeft === 0 ? "today" : daysLeft > 0 ? `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : `${-daysLeft} day${daysLeft === -1 ? "" : "s"} late`;
    parts.push(`${formatDate(dueDate)} (${rel})`);
  }
  if (dueMeter != null) {
    const left = meterLeft == null ? "" : meterLeft > 0 ? ` (${formatNumber(meterLeft)} left)` : ` (${formatNumber(-meterLeft)} over)`;
    parts.push(`at ${formatNumber(dueMeter)} ${meterUnit ?? ""}`.trim() + left);
  }
  return <span>{parts.join(" · ") || "No due date"}</span>;
}

/** "Mar 3, 2026 (in 4 days)" and/or "1,250 hours (40 left)". */
export function DueText({ due, meterUnit }: { due: DueInfo; meterUnit: string | null }) {
  const parts: string[] = [];
  if (due.nextDueAt) {
    const d = due.daysLeft!;
    const rel = d === 0 ? "today" : d > 0 ? `in ${d} day${d === 1 ? "" : "s"}` : `${-d} day${d === -1 ? "" : "s"} late`;
    parts.push(`${formatDate(due.nextDueAt)} (${rel})`);
  }
  if (due.nextDueMeter != null) {
    const left =
      due.meterLeft == null ? "no reading yet" : due.meterLeft > 0 ? `${formatNumber(due.meterLeft)} left` : `${formatNumber(-due.meterLeft)} over`;
    parts.push(`${formatNumber(due.nextDueMeter)} ${meterUnit ?? ""} (${left})`);
  }
  return <span>{parts.join(" · ") || "—"}</span>;
}

/** Page title with its actions on the right: one main button, plus a More menu for the rest. */
export function PageHeader({ title, children, description }: { title: string; children?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-ink">{title}</h1>
        {description && <p className="mt-0.5 max-w-3xl text-sm text-neutral-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export interface TabLink {
  key: string;
  label: string;
  href: string;
  count?: number;
}

/** Tabs between the pages of one section (e.g. Assets · Locations): bold for the one you're on. */
export function Tabs({ tabs, active, label }: { tabs: TabLink[]; active: string; label: string }) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label={label} className="-mx-4 mb-5 overflow-x-auto px-4 lg:mx-0 lg:px-0">
      <ul className="flex gap-5 text-sm">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={t.key === active ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 py-1 whitespace-nowrap ${
                t.key === active ? "font-semibold text-ink" : "text-neutral-500 hover:text-ink"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 && <span className="rounded-md bg-neutral-100 px-1.5 text-xs font-normal text-neutral-600">{t.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>
      {children}
    </Link>
  );
}

/** A soft grey panel with a small bold title. */
export function Card({ title, children, actions, className = "" }: { title?: string; children: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-surface p-5 sm:p-6 ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** A headline number on a pastel tile (the tiles alternate lavender and blue). */
export function StatTile({
  label,
  value,
  detail,
  href,
  tone = "lavender",
  alert = false,
  help,
}: {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  href?: string;
  tone?: "lavender" | "blue";
  /** Marks a number that needs action (e.g. overdue work) with a red dot. */
  alert?: boolean;
  help?: string;
}) {
  const body = (
    <>
      <div className="flex items-center gap-1.5 text-sm text-ink">
        {alert && <span className="size-1.5 rounded-full bg-red-500" aria-hidden="true" />}
        {label}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-2xl font-semibold text-ink">{value}</span>
        {detail && <span className="text-xs text-neutral-600">{detail}</span>}
      </div>
    </>
  );
  const cls = `block rounded-2xl p-5 sm:p-6 ${tone === "lavender" ? "bg-pastel-lavender" : "bg-pastel-blue"}`;
  return href ? (
    <Link href={href} title={help} className={`${cls} transition hover:brightness-[0.98] hover:ring-1 hover:ring-neutral-300/60`}>
      {body}
    </Link>
  ) : (
    <div title={help} className={cls}>
      {body}
    </div>
  );
}

/** "+12% ↗" against an earlier period; green when the change is good. */
export function Delta({ now, before, upIsGood = true, period }: { now: number; before: number; upIsGood?: boolean; period: string }) {
  if (before === 0 && now === 0) return <span className="text-neutral-500">no change {period}</span>;
  const pct = before === 0 ? null : Math.round(((now - before) / before) * 100);
  const up = now > before;
  const flat = now === before;
  const good = flat ? null : up === upIsGood;
  const color = good == null ? "text-neutral-600" : good ? "text-emerald-700" : "text-red-700";
  const text = pct == null ? `+${now}` : `${pct > 0 ? "+" : ""}${pct}%`;
  return (
    <span className={`inline-flex items-center gap-1 ${color}`} title={`${now} now, ${before} ${period}`}>
      {text}
      {!flat && (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={`size-3.5 ${up ? "" : "-scale-y-100"}`} aria-hidden="true">
          <path d="M2 11.5 6 7.5l2.5 2.5L14 4.5M10 4.5h4v4" />
        </svg>
      )}
      <span className="sr-only">{period}</span>
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-neutral-500">{children}</p>;
}
