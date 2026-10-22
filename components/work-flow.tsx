// The pictures that explain how the system works, shared by the welcome, the
// dashboard's getting-started cards and the Help page. No hooks, so they render
// on the server or inside client components alike.
import { Icon, type IconName } from "./icons";

export interface Step {
  icon: IconName;
  title: string;
  text: string;
}

/** Doing a work order, start to finish. */
export const WORK_ORDER_STEPS: Step[] = [
  { icon: "clipboard", title: "Open it", text: "From Needs attention on the dashboard, or Work orders → Assigned to me." },
  { icon: "play", title: "Start work", text: "Press Start work — or ⏱ Start timer to log your time as you go. Everyone sees it's In progress." },
  { icon: "list", title: "Work the checklist", text: "Answers save as you go. Add the parts you used, and photos." },
  { icon: "check", title: "Mark it complete", text: "Say what you did. For a PM, the next one is scheduled by itself." },
];

/** What happens to a reported problem. */
export const REQUEST_STEPS: Step[] = [
  { icon: "alert", title: "You report it", text: "Pick the machine, say what's wrong, and tick if it has stopped." },
  { icon: "inbox", title: "Maintenance reviews it", text: "An admin approves it, or explains why not." },
  { icon: "clipboard", title: "It becomes a work order", text: "A technician does the work and records it." },
  { icon: "check", title: "It's done", text: "You're notified at each step (the bell at the top)." },
];

/** Numbered steps: across the page when there's room, a list when there isn't. */
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <div className="@container">
      <ol className="grid gap-4 @2xl:grid-cols-4 @2xl:gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 @2xl:flex-col">
            <div className="flex items-center gap-2 @2xl:w-full">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-ink ring-1 ring-neutral-200">
                <Icon name={s.icon} className="size-4" />
              </span>
              {/* The line on to the next step, when they run across. */}
              {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-neutral-300 @2xl:block" aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">
                <span className="text-neutral-500">{i + 1}.</span> {s.title}
              </div>
              <p className="mt-0.5 text-sm text-neutral-600">{s.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Node({ icon, title, text, strong = false }: { icon: IconName; title: string; text: string; strong?: boolean }) {
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-3 py-2.5 ${strong ? "bg-ink text-white" : "bg-white ring-1 ring-neutral-200"}`}>
      <Icon name={icon} className={`mt-0.5 size-4 ${strong ? "text-white" : "text-ink"}`} />
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <div className={`text-xs ${strong ? "text-white/75" : "text-neutral-500"}`}>{text}</div>
      </div>
    </div>
  );
}

const arrow = (name: "arrowRight" | "arrowDown", className = "") => (
  <Icon name={name} className={`size-5 shrink-0 text-neutral-500 ${className}`} />
);

/** Where work orders come from and where they go. */
export function WorkFlow() {
  const pm = <Node icon="repeat" title="PM schedule" text="comes due by date or hours" />;
  const request = <Node icon="alert" title="Request" text="a problem someone reported, approved by an admin" />;
  const wo = <Node icon="clipboard" title="Work order" text="checklist, time, parts, photos" strong />;
  const done = <Node icon="check" title="Done" text="in the history and reports; next PM scheduled" />;
  return (
    <div className="@container" role="img" aria-label="PM schedules and approved requests become work orders; done work goes into the history and reports.">
      {/* Across, when there's room */}
      <div className="hidden grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-3 @xl:grid" aria-hidden="true">
        {pm}
        {arrow("arrowRight", "rotate-[25deg]")}
        <div className="row-span-2">{wo}</div>
        <div className="row-span-2">{arrow("arrowRight")}</div>
        <div className="row-span-2">{done}</div>
        {request}
        {arrow("arrowRight", "-rotate-[25deg]")}
      </div>
      {/* Down, on a narrow screen */}
      <div className="flex flex-col items-center gap-2 @xl:hidden" aria-hidden="true">
        <div className="grid w-full grid-cols-2 gap-2">
          {pm}
          {request}
        </div>
        {arrow("arrowDown")}
        <div className="w-full">{wo}</div>
        {arrow("arrowDown")}
        <div className="w-full">{done}</div>
      </div>
    </div>
  );
}

/** What the colours and marks on the screens mean. */
export function Legend() {
  const rows: [React.ReactNode, string][] = [
    [<Dot key="o" color="bg-red-500" text="text-red-700" label="Overdue" />, "Past its due date. Do these first."],
    [<Dot key="s" color="bg-amber-400" text="text-amber-700" label="Due soon" />, "Due within the week, or close on hours."],
    [
      <span key="d" className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 ring-1 ring-red-200 ring-inset">
        <span className="size-1.5 rounded-full bg-red-500" />
        Down
      </span>,
      "The machine has stopped. Mark it back up when it runs again.",
    ],
    [<span key="h" className="text-xs font-semibold text-red-700">High</span>, "Priority: High, Medium or Low."],
    [
      <span key="b" className="min-w-5 rounded-md bg-red-50 px-1.5 text-center text-xs leading-5 font-medium text-red-700">
        3
      </span>,
      "Numbers in the sidebar: how many need attention there.",
    ],
  ];
  return (
    <dl className="divide-y divide-neutral-200/70">
      {rows.map(([mark, text], i) => (
        <div key={i} className="flex items-center gap-4 py-2.5">
          <dt className="w-24 shrink-0">{mark}</dt>
          <dd className="text-sm text-neutral-600">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

function Dot({ color, text, label }: { color: string; text: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <span className={`size-1.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}
