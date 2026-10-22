// Onboarding: the welcome and tour on someone's first visit (and again when
// their role changes), and the getting-started card on the dashboard. Pure, so
// the rules are tested; the pages load the counts.
import type { Role } from "@prisma/client";

/** New people haven't had the welcome; nor has someone whose role just changed
 *  (a requester made a technician gets the technician's tour). */
export function needsWelcome(user: { role: Role; welcomedAs: Role | null }): boolean {
  return user.welcomedAs !== user.role;
}

/** The getting-started card shows until it's hidden, and comes back with a new role. */
export function showsGuide(user: { role: Role; guideHiddenAs: Role | null }): boolean {
  return user.guideHiddenAs !== user.role;
}

export interface SetupCounts {
  locations: number;
  assets: number;
  pmSchedules: number;
  parts: number;
  /** Active admins and technicians, including you. */
  staff: number;
  completedWorkOrders: number;
}

export interface SetupStep {
  key: string;
  title: string;
  text: string;
  href: string;
  action: string;
  done: boolean;
  /** Not needed to call the system set up. */
  optional?: boolean;
}

/** An admin's steps to get a new system going, ticked off from what's in it. */
export function setupSteps(c: SetupCounts): SetupStep[] {
  return [
    {
      key: "locations",
      title: "Add your locations",
      text: "Your plant, then the areas and lines inside it, so equipment is easy to find.",
      href: "/locations",
      action: "Add locations",
      done: c.locations > 0,
    },
    {
      key: "equipment",
      title: "Add your equipment",
      text: "One machine at a time, or a whole list from Excel (Equipment → More → Import).",
      href: "/assets/new",
      action: "Add equipment",
      done: c.assets > 0,
    },
    {
      key: "pm",
      title: "Set up preventive maintenance",
      text: "Open a machine → PM schedules → + PM schedule. Work orders are then made for you when it comes due.",
      href: "/assets",
      action: "Pick a machine",
      done: c.pmSchedules > 0,
    },
    {
      key: "team",
      title: "Bring in your team",
      text: "Ask them to sign in with their work email, then make them Technicians on the People page.",
      href: "/people",
      action: "Open People",
      done: c.staff > 1,
    },
    {
      key: "parts",
      title: "List your spare parts",
      text: "Track what's on the shelf and get told when it runs low.",
      href: "/parts/new",
      action: "Add a part",
      done: c.parts > 0,
      optional: true,
    },
    {
      key: "first-work-order",
      title: "Complete a work order",
      text: "Try it end to end: start one, work through its checklist, mark it complete.",
      href: "/work-orders",
      action: "Open work orders",
      done: c.completedWorkOrders > 0,
    },
  ];
}

/** "3 of 5 done" counts the steps that matter; optional ones only once done. */
export function setupProgress(steps: SetupStep[]): { done: number; total: number; complete: boolean } {
  const counted = steps.filter((s) => !s.optional || s.done);
  const done = counted.filter((s) => s.done).length;
  const required = steps.filter((s) => !s.optional);
  return { done, total: counted.length, complete: required.every((s) => s.done) };
}
