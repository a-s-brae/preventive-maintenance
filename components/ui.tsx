import Link from "next/link";
import type { Priority, WorkOrderStatus } from "@prisma/client";
import type { DueInfo, DueStatus } from "@/lib/schedule";
import { PRIORITY_LABEL, STATUS_LABEL as WO_STATUS_LABEL } from "@/lib/work-orders";
import { formatDate, formatNumber } from "@/lib/forms";

const STATUS_STYLE: Record<DueStatus, string> = {
  OVERDUE: "bg-red-100 text-red-800 ring-red-200",
  DUE_SOON: "bg-amber-100 text-amber-800 ring-amber-200",
  OK: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  NO_SCHEDULE: "bg-slate-100 text-slate-600 ring-slate-200",
};
const STATUS_LABEL: Record<DueStatus, string> = {
  OVERDUE: "Overdue",
  DUE_SOON: "Due soon",
  OK: "OK",
  NO_SCHEDULE: "No schedule",
};

const REQUEST_STATUS: Record<"PENDING" | "APPROVED" | "REJECTED", [string, string]> = {
  PENDING: ["Waiting for review", "bg-amber-100 text-amber-800 ring-amber-200"],
  APPROVED: ["Approved", "bg-emerald-100 text-emerald-800 ring-emerald-200"],
  REJECTED: ["Rejected", "bg-slate-200 text-slate-700 ring-slate-300"],
};

export function RequestStatusBadge({ status }: { status: "PENDING" | "APPROVED" | "REJECTED" }) {
  const [label, style] = REQUEST_STATUS[status];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${style}`}>{label}</span>;
}

/** Red "Down" pill for equipment with open downtime. */
export function DownBadge({ since }: { since?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white">
      <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />
      Down{since ? ` · ${since}` : ""}
    </span>
  );
}

export function StatusBadge({ status }: { status: DueStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const WO_STATUS_STYLE: Record<WorkOrderStatus, string> = {
  OPEN: "bg-sky-100 text-sky-800 ring-sky-200",
  IN_PROGRESS: "bg-violet-100 text-violet-800 ring-violet-200",
  ON_HOLD: "bg-slate-200 text-slate-700 ring-slate-300",
  COMPLETE: "bg-emerald-100 text-emerald-800 ring-emerald-200",
};

export function WoStatusBadge({ status }: { status: WorkOrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${WO_STATUS_STYLE[status]}`}>
      {WO_STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY_STYLE: Record<Priority, string> = {
  NONE: "text-slate-400",
  LOW: "text-slate-600",
  MEDIUM: "text-amber-700",
  HIGH: "text-red-700 font-semibold",
};

export function PriorityText({ priority }: { priority: Priority }) {
  if (priority === "NONE") return <span className="text-slate-400">—</span>;
  return <span className={`text-xs uppercase tracking-wide ${PRIORITY_STYLE[priority]}`}>{PRIORITY_LABEL[priority]}</span>;
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

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

export function ButtonLink({ href, children, variant = "primary" }: { href: string; children: React.ReactNode; variant?: "primary" | "secondary" }) {
  return (
    <Link href={href} className={variant === "primary" ? "btn-primary" : "btn-secondary"}>
      {children}
    </Link>
  );
}

export function Card({ title, children, actions }: { title?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-medium">{title}</h2>
          <div className="flex gap-2">{actions}</div>
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-500">{children}</p>;
}
