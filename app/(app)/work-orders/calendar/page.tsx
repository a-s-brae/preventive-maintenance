import Link from "next/link";
import { db } from "@/lib/db";
import { getOpenWorkOrders, getPmSchedules } from "@/lib/queries";
import { addInterval, fixedOccurrence } from "@/lib/schedule";
import { woNumber } from "@/lib/work-orders";
import { ButtonLink, Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

type Item = { key: string; href: string; label: string; kind: "overdue" | "open" | "done" | "planned" };

const KIND_STYLE: Record<Item["kind"], string> = {
  overdue: "bg-red-100 text-red-800",
  open: "bg-sky-100 text-sky-800",
  done: "bg-slate-100 text-slate-500 line-through",
  planned: "border border-dashed border-slate-300 text-slate-600",
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const MAX_PER_DAY = 3;

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month } = await searchParams;
  const today = new Date();
  const [y, m] = /^\d{4}-\d{2}$/.test(month ?? "") ? month!.split("-").map(Number) : [today.getUTCFullYear(), today.getUTCMonth() + 1];
  const first = new Date(Date.UTC(y, m - 1, 1, 12));
  const last = new Date(Date.UTC(y, m, 0, 12));
  const todayKey = dayKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12)));

  const [open, done, schedules] = await Promise.all([
    getOpenWorkOrders({ dueDate: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } }),
    db.workOrder.findMany({
      where: { status: "COMPLETE", completedAt: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } },
      include: { asset: true },
    }),
    getPmSchedules({ active: true, asset: { status: "ACTIVE" } }),
  ]);

  const byDay = new Map<string, Item[]>();
  const add = (date: Date, item: Item) => byDay.set(dayKey(date), [...(byDay.get(dayKey(date)) ?? []), item]);

  for (const wo of open) {
    add(wo.dueDate!, {
      key: wo.id,
      href: `/work-orders/${wo.id}`,
      label: `${woNumber(wo.number)} ${wo.title} — ${wo.asset.name}`,
      kind: wo.due.status === "OVERDUE" ? "overdue" : "open",
    });
  }
  for (const wo of done) {
    add(wo.completedAt!, { key: wo.id, href: `/work-orders/${wo.id}`, label: `${wo.title} — ${wo.asset.name}`, kind: "done" });
  }

  // Planned: future calendar occurrences of each PM schedule that don't have a work order yet.
  for (const { task, openWorkOrder, due } of schedules) {
    if (!task.calendarEvery || !task.calendarUnit || !due?.nextDueAt) continue;
    const every = task.calendarEvery;
    const unit = task.calendarUnit;
    let n = openWorkOrder ? (openWorkOrder.cycle ?? task.fixedCycle) + 1 : task.fixedCycle;
    let date = openWorkOrder ? (openWorkOrder.dueDate ? addInterval(openWorkOrder.dueDate, every, unit) : null) : due.nextDueAt;
    if (task.scheduleBasis === "FIXED") date = fixedOccurrence(task.startDate, every, unit, n);
    for (let guard = 0; date && date <= last && guard < 400; guard++) {
      if (date >= first && dayKey(date) >= todayKey) {
        add(date, { key: `${task.id}-${dayKey(date)}`, href: `/tasks/${task.id}/edit`, label: `${task.title} — ${task.asset.name}`, kind: "planned" });
      }
      date = task.scheduleBasis === "FIXED" ? fixedOccurrence(task.startDate, every, unit, ++n) : addInterval(date, every, unit);
    }
  }

  const days = Array.from({ length: last.getUTCDate() }, (_, i) => new Date(Date.UTC(y, m - 1, i + 1, 12)));
  const leading = first.getUTCDay();
  const monthLabel = first.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
  const shift = (by: number) => {
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    return `/work-orders/calendar?month=${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  return (
    <>
      <PageHeader title="Calendar">
        <ButtonLink href="/work-orders" variant="secondary">
          List
        </ButtonLink>
        <ButtonLink href="/work-orders/new">New work order</ButtonLink>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={shift(-1)} className="btn-icon" aria-label="Previous month">
            ←
          </Link>
          <h2 className="w-44 text-center font-medium">{monthLabel}</h2>
          <Link href={shift(1)} className="btn-icon" aria-label="Next month">
            →
          </Link>
          <Link href="/work-orders/calendar" className="link ml-2 text-sm">
            Today
          </Link>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          {(["overdue", "open", "planned", "done"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-5 rounded ${KIND_STYLE[k]}`} />
              {{ overdue: "Overdue", open: "Open work order", planned: "Planned PM", done: "Completed" }[k]}
            </span>
          ))}
        </div>
      </div>

      <Card>
        {/* Month grid on larger screens */}
        <div className="hidden sm:block">
          <div className="grid grid-cols-7 border-b border-slate-200 pb-2 text-center text-xs font-medium text-slate-500 uppercase">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: leading }, (_, i) => (
              <div key={`blank-${i}`} className="min-h-28 border-r border-b border-slate-100" />
            ))}
            {days.map((d) => {
              const items = byDay.get(dayKey(d)) ?? [];
              const isToday = dayKey(d) === todayKey;
              return (
                <div key={dayKey(d)} className="min-h-28 border-r border-b border-slate-100 p-1">
                  <div className={`mb-1 text-right text-xs ${isToday ? "font-semibold text-sky-700" : "text-slate-500"}`}>
                    {isToday ? <span className="rounded-full bg-sky-700 px-1.5 py-0.5 text-white">{d.getUTCDate()}</span> : d.getUTCDate()}
                  </div>
                  <div className="space-y-1">
                    {items.slice(0, MAX_PER_DAY).map((it) => (
                      <Link key={it.key} href={it.href} title={it.label} className={`block truncate rounded px-1.5 py-0.5 text-xs ${KIND_STYLE[it.kind]}`}>
                        {it.label}
                      </Link>
                    ))}
                    {items.length > MAX_PER_DAY && <div className="px-1.5 text-xs text-slate-500">+{items.length - MAX_PER_DAY} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Agenda on phones */}
        <ul className="space-y-4 sm:hidden">
          {days.filter((d) => byDay.has(dayKey(d))).length === 0 && <li className="py-6 text-center text-sm text-slate-500">Nothing this month.</li>}
          {days
            .filter((d) => byDay.has(dayKey(d)))
            .map((d) => (
              <li key={dayKey(d)}>
                <div className={`mb-1 text-sm font-medium ${dayKey(d) === todayKey ? "text-sky-700" : ""}`}>
                  {d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })}
                </div>
                <div className="space-y-1">
                  {byDay.get(dayKey(d))!.map((it) => (
                    <Link key={it.key} href={it.href} className={`block rounded px-2 py-1 text-sm ${KIND_STYLE[it.kind]}`}>
                      {it.label}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
        </ul>
      </Card>
    </>
  );
}
