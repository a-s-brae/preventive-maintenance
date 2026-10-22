import { expect, it } from "vitest";
import { needsWelcome, setupProgress, setupSteps, showsGuide } from "./onboarding";

it("welcomes new people, and again when their role changes", () => {
  expect(needsWelcome({ role: "REQUESTER", welcomedAs: null })).toBe(true);
  expect(needsWelcome({ role: "REQUESTER", welcomedAs: "REQUESTER" })).toBe(false);
  // Made a technician after their first visit: they get the technician's tour.
  expect(needsWelcome({ role: "TECH", welcomedAs: "REQUESTER" })).toBe(true);
  expect(showsGuide({ role: "ADMIN", guideHiddenAs: null })).toBe(true);
  expect(showsGuide({ role: "ADMIN", guideHiddenAs: "ADMIN" })).toBe(false);
  expect(showsGuide({ role: "TECH", guideHiddenAs: "REQUESTER" })).toBe(true);
});

const empty = { locations: 0, assets: 0, pmSchedules: 0, parts: 0, staff: 1, completedWorkOrders: 0 };

it("ticks off setup steps from what's in the system", () => {
  const fresh = setupSteps(empty);
  expect(fresh.every((s) => !s.done)).toBe(true);
  // Parts are optional: not counted until done.
  expect(setupProgress(fresh)).toEqual({ done: 0, total: 5, complete: false });

  const going = setupSteps({ ...empty, locations: 3, assets: 12, pmSchedules: 4 });
  expect(going.filter((s) => s.done).map((s) => s.key)).toEqual(["locations", "equipment", "pm"]);
  expect(setupProgress(going)).toEqual({ done: 3, total: 5, complete: false });

  // A team of one isn't a team yet; a second admin or technician is.
  expect(setupSteps({ ...empty, staff: 1 }).find((s) => s.key === "team")!.done).toBe(false);
  expect(setupSteps({ ...empty, staff: 2 }).find((s) => s.key === "team")!.done).toBe(true);

  const all = setupSteps({ locations: 1, assets: 1, pmSchedules: 1, parts: 0, staff: 2, completedWorkOrders: 1 });
  expect(setupProgress(all)).toEqual({ done: 5, total: 5, complete: true });
  expect(setupProgress(setupSteps({ locations: 1, assets: 1, pmSchedules: 1, parts: 5, staff: 2, completedWorkOrders: 1 }))).toEqual({
    done: 6,
    total: 6,
    complete: true,
  });
});
