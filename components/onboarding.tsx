"use client";

// First visit: a few welcome slides on how the system works, then a tour that
// points at the real screen. Both come back when someone's role changes, and
// the tour can be replayed from Help (/?tour=1).

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "./avatar";
import { Icon } from "./icons";
import type { Role } from "./sidebar";
import { Legend, REQUEST_STEPS, Steps, WORK_ORDER_STEPS, WorkFlow } from "./work-flow";

const ROLE_INTRO: Record<Role, { name: string; text: string }> = {
  ADMIN: {
    name: "an Admin",
    text: "You set it up and run it: equipment, PM schedules, people, and reviewing the problems people report. You can do the work too.",
  },
  TECH: {
    name: "a Technician",
    text: "You see all the equipment and work, and you do and record the work: checklists, time, parts and photos.",
  },
  REQUESTER: {
    name: "a Requester",
    text: "You can report problems with equipment and follow what happens to them.",
  },
};

interface Slide {
  title: string;
  body: React.ReactNode;
}

function slidesFor(role: Role, user: { id: string; name: string }): Slide[] {
  // "Dana" from "Dana Ruiz"; the whole name when it starts with an initial ("B. Colegrove").
  const firstWord = user.name.split(" ")[0].replace(/\.$/, "");
  const first = firstWord.length > 1 ? firstWord : user.name;
  const intro = ROLE_INTRO[role];
  const welcome: Slide = {
    title: `Welcome to PM System, ${first}`,
    body: (
      <>
        <p>
          This is where A.S. Plastech looks after its equipment: planned maintenance comes up on time, problems get reported and fixed, and every job
          is on record.
        </p>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-pastel-lavender p-4">
          <Avatar name={user.name} seed={user.id} className="size-9 text-xs" />
          <div>
            <div className="font-medium text-ink">You&apos;re signed in as {intro.name}</div>
            <p className="mt-0.5 text-sm text-neutral-600">{intro.text}</p>
          </div>
        </div>
        {role === "REQUESTER" && (
          <p className="mt-3 text-sm text-neutral-600">
            On the maintenance team? An admin can make you a Technician — they&apos;ve been told you&apos;ve joined.
          </p>
        )}
      </>
    ),
  };
  if (role === "REQUESTER") {
    return [
      welcome,
      { title: "What happens when you report a problem", body: <Steps steps={REQUEST_STEPS} /> },
      {
        title: "Good to know",
        body: (
          <ul className="space-y-3">
            <Tip icon="qr" title="Scan the machine's QR code">
              Point your phone camera at the label on a machine to report a problem with it — the machine is filled in for you.
            </Tip>
            <Tip icon="down" title="Say if it has stopped">
              Tick &ldquo;the machine is down&rdquo; when it can&apos;t run. That gets attention fastest.
            </Tip>
            <Tip icon="bell" title="Watch the bell">
              You&apos;re told when your request is approved, turned down, or the work is done.
            </Tip>
          </ul>
        ),
      },
    ];
  }
  const flow: Slide = {
    title: "How work flows",
    body: (
      <>
        <WorkFlow />
        <ul className="mt-4 space-y-1.5 text-sm text-neutral-600">
          <li>
            • <strong className="font-medium text-ink">PM schedules</strong> make work orders by themselves when maintenance comes due — by date, by
            hours or miles, or whichever comes first.
          </li>
          <li>
            • <strong className="font-medium text-ink">Requests</strong>: anyone can report a problem; an admin approves it into a work order.
          </li>
          <li>
            • <strong className="font-medium text-ink">Done</strong> work goes into the machine&apos;s history and the reports.
          </li>
        </ul>
      </>
    ),
  };
  const doing: Slide = { title: "Doing a work order", body: <Steps steps={WORK_ORDER_STEPS} /> };
  const reading: Slide = {
    title: "Reading the screen",
    body: (
      <>
        <Legend />
        <p className="mt-3 text-sm text-neutral-600">
          Start your day on the <strong className="font-medium text-ink">Dashboard</strong>: <em>Needs attention</em> lists what&apos;s overdue or due
          this week, most urgent first.
        </p>
      </>
    ),
  };
  if (role === "TECH") return [welcome, flow, doing, reading];
  return [
    welcome,
    flow,
    reading,
    {
      title: "First, set it up",
      body: (
        <>
          <ol className="space-y-2 text-sm text-neutral-600">
            {[
              ["Locations", "your plant, its areas and lines"],
              ["Equipment", "each machine, or a list imported from Excel"],
              ["PM schedules", "what to do to each machine, and how often"],
              ["Your team", "they sign in, you make them Technicians"],
            ].map(([what, text], i) => (
              <li key={what} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-medium text-white">{i + 1}</span>
                <span>
                  <strong className="font-medium text-ink">{what}</strong> — {text}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 rounded-xl bg-pastel-blue p-3 text-sm text-neutral-700">
            A checklist on your dashboard ticks these off as you go. Just exploring? Load the sample equipment from the dashboard to try everything
            first.
          </p>
        </>
      ),
    },
  ];
}

function Tip({ icon, title, children }: { icon: "qr" | "down" | "bell"; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pastel-blue text-ink">
        <Icon name={icon} className="size-4" />
      </span>
      <div>
        <div className="text-sm font-medium text-ink">{title}</div>
        <p className="text-sm text-neutral-600">{children}</p>
      </div>
    </li>
  );
}

/** Keep Tab inside a dialog. */
function trapTab(e: React.KeyboardEvent<HTMLElement>) {
  if (e.key !== "Tab") return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(
    (el) => !el.hasAttribute("disabled"),
  );
  if (items.length === 0) return;
  const [first, last] = [items[0], items[items.length - 1]];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** The welcome slides. Ends with "Show me around" (the tour) or skipping it. */
export function Welcome({ role, user, onDone }: { role: Role; user: { id: string; name: string }; onDone: (tour: boolean) => void }) {
  const slides = slidesFor(role, user);
  const [i, setI] = useState(0);
  const primary = useRef<HTMLButtonElement>(null);
  const last = i === slides.length - 1;
  useEffect(() => primary.current?.focus(), [i]);
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onDone(false);
          trapTab(e);
        }}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between px-6 pt-5 text-xs text-neutral-500">
          <span>
            {i + 1} of {slides.length}
          </span>
          <button type="button" onClick={() => onDone(false)} className="hover:text-ink">
            Skip
          </button>
        </div>
        <div className="overflow-y-auto px-6 pt-2 pb-5">
          <h2 id="welcome-title" aria-live="polite" className="mb-4 text-lg font-semibold text-ink">
            {slides[i].title}
          </h2>
          <div className="text-sm text-neutral-700">{slides[i].body}</div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-neutral-200/70 px-6 py-4">
          <div className="flex gap-1.5" aria-hidden="true">
            {slides.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-ink" : "w-1.5 bg-neutral-300"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} className="btn-secondary">
                Back
              </button>
            )}
            {last ? (
              <button ref={primary} type="button" onClick={() => onDone(true)} className="btn-primary">
                Show me around
              </button>
            ) : (
              <button ref={primary} type="button" onClick={() => setI(i + 1)} className="btn-primary">
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ─── The tour ────────────────────────────────────────────────────────────────

export interface TourStep {
  /** CSS selectors, comma-separated; the first one showing on screen is used. */
  target: string;
  title: string;
  body: string;
}

/** The stops, by role. Stops whose part of the screen isn't showing (a closed
 *  panel, the sidebar on a phone) are left out when the tour starts. */
export function tourSteps(role: Role): TourStep[] {
  const nav = '[data-tour="nav"], [data-tour="menu"]';
  if (role === "REQUESTER") {
    return [
      {
        target: '[data-tour="report-big"], [data-tour="report"]',
        title: "Report a problem",
        body: "Something wrong with equipment? Tell maintenance here: pick the machine, say what's wrong, and whether it has stopped.",
      },
      {
        target: '[data-tour="my-requests"]',
        title: "Follow your requests",
        body: "Each one shows where it's at: waiting for review, approved (a work order is made), or done.",
      },
      { target: '[data-tour="bell"]', title: "Notifications", body: "You're told here when a request is approved, turned down, or the work is done." },
      { target: nav, title: "Your pages", body: "Home and My requests — in the sidebar, or behind this button on a phone. That's all you need." },
      {
        target: '[data-tour="help"]',
        title: "Help is here",
        body: "How it all works, including reporting from your phone by scanning a machine's QR code. You can replay this tour from there.",
      },
    ];
  }
  return [
    ...(role === "ADMIN"
      ? [
          {
            target: '[data-tour="setup"]',
            title: "Set it up",
            body: "Your steps to get going: locations, equipment, PM schedules and your team. They tick off as you go.",
          },
        ]
      : []),
    {
      target: '[data-tour="tiles"]',
      title: "Your day at a glance",
      body: "What's overdue, due this week, and assigned to you. Click a tile to open that list.",
    },
    {
      target: '[data-tour="attention"]',
      title: "Start here",
      body: "Work that's overdue or due this week, most urgent first. Open one to do it.",
    },
    {
      target: nav,
      title: "Find your way",
      body: "Work orders, Requests, PM schedules, Equipment and Parts — in the sidebar, or behind this button on a phone. Red and amber numbers flag what needs attention.",
    },
    {
      target: '[data-tour="quick"]',
      title: "Favorites and recent",
      body: "Star any page (☆ at the top) to keep it here, filters and all. Recently lists the work orders and machines you opened.",
    },
    {
      target: '[data-tour="new"]',
      title: "Make something new",
      body:
        role === "ADMIN"
          ? "A work order, a problem report, a machine or a part — from any page."
          : "A work order, or a problem report — from any page.",
    },
    { target: '[data-tour="search"]', title: "Search", body: "Find any work order, machine, part or request. Press ⌘K (Ctrl K) from anywhere." },
    {
      target: '[data-tour="bell"]',
      title: "Notifications",
      body:
        role === "ADMIN"
          ? "Work assigned to you, new requests, new people, and parts running low."
          : "You're told here when work is assigned to you or a PM comes due for you.",
    },
    {
      target: '[data-tour="activity"]',
      title: "Team activity",
      body: "Your latest notifications and what the team has done lately. Hide it with the panel button at the top right.",
    },
    {
      target: '[data-tour="help"]',
      title: "Help is here",
      body: "The guide explains everything — PM schedules, due dates, requests, downtime, parts and reports. Replay this tour from there.",
    },
  ];
}

function shownTarget(selectors: string): HTMLElement | null {
  for (const sel of selectors.split(",")) {
    for (const el of document.querySelectorAll<HTMLElement>(sel.trim())) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
  }
  return null;
}

const GAP = 12;
const EDGE = 16;
const PAD = 6;

/** A spotlight on one part of the screen at a time, with a note beside it. */
export function Tour({ steps: allSteps, onClose }: { steps: TourStep[]; onClose: (finished: boolean) => void }) {
  // Only the stops that are on screen now.
  const [steps] = useState(() => allSteps.filter((s) => shownTarget(s.target)));
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const step = steps[i];

  const measure = useCallback(() => {
    const el = step && shownTarget(step.target);
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  // Bring the stop into view, then measure it.
  useLayoutEffect(() => {
    const el = step && shownTarget(step.target);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
    primary.current?.focus();
  }, [step, measure]);

  useEffect(() => {
    let frame = 0;
    const later = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    window.addEventListener("resize", later);
    window.addEventListener("scroll", later, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", later);
      window.removeEventListener("scroll", later, true);
    };
  }, [measure]);

  // Put the note below, beside or above the spotlight — wherever it fits.
  useLayoutEffect(() => {
    const c = card.current;
    if (!c) return;
    const w = c.offsetWidth;
    const h = c.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampX = (x: number) => Math.min(Math.max(EDGE, x), vw - w - EDGE);
    const clampY = (y: number) => Math.min(Math.max(EDGE, y), vh - h - EDGE);
    if (!rect) {
      setPos({ top: (vh - h) / 2, left: (vw - w) / 2 });
      return;
    }
    const below = rect.bottom + PAD + GAP;
    const right = rect.right + PAD + GAP;
    const above = rect.top - PAD - GAP - h;
    const left = rect.left - PAD - GAP - w;
    if (below + h <= vh - EDGE) setPos({ top: below, left: clampX(rect.left) });
    else if (right + w <= vw - EDGE) setPos({ top: clampY(rect.top), left: right });
    else if (above >= EDGE) setPos({ top: above, left: clampX(rect.left) });
    else if (left >= EDGE) setPos({ top: clampY(rect.top), left });
    else setPos({ top: clampY(rect.bottom - h), left: clampX(rect.left) });
  }, [rect, i]);

  useEffect(() => {
    if (steps.length === 0) onClose(true);
  }, [steps.length, onClose]);
  if (!step) return null;
  const last = i === steps.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[60]" onKeyDown={(e) => e.key === "Escape" && onClose(false)}>
      {/* Dims everything but the stop, and keeps clicks off the page meanwhile. */}
      <div className="absolute inset-0" />
      <div
        className="pointer-events-none fixed rounded-xl ring-2 ring-white/80 transition-all duration-300"
        style={
          rect
            ? {
                top: rect.top - PAD,
                left: rect.left - PAD,
                width: rect.width + PAD * 2,
                height: rect.height + PAD * 2,
                boxShadow: "0 0 0 9999px rgb(28 28 28 / 0.55)",
              }
            : { top: "50%", left: "50%", width: 0, height: 0, boxShadow: "0 0 0 9999px rgb(28 28 28 / 0.55)" }
        }
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        onKeyDown={trapTab}
        className="fixed w-[min(340px,calc(100vw-32px))] rounded-2xl bg-white p-5 shadow-xl ring-1 ring-neutral-200 transition-[top,left] duration-300"
        style={pos ?? { top: -9999, left: -9999 }}
      >
        <div className="mb-1 flex items-center justify-between text-xs text-neutral-500">
          <span>
            {i + 1} of {steps.length}
          </span>
          <button type="button" onClick={() => onClose(false)} className="hover:text-ink">
            Skip tour
          </button>
        </div>
        <div aria-live="polite">
          <h2 id="tour-title" className="text-sm font-semibold text-ink">
            {step.title}
          </h2>
          <p id="tour-body" className="mt-1 text-sm text-neutral-600">
            {step.body}
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-1" aria-hidden="true">
            {steps.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full ${n === i ? "w-4 bg-ink" : "w-1.5 bg-neutral-300"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 && (
              <button type="button" onClick={() => setI(i - 1)} className="btn-secondary h-8 px-3">
                Back
              </button>
            )}
            <button ref={primary} type="button" onClick={() => (last ? onClose(true) : setI(i + 1))} className="btn-primary h-8 px-3">
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
