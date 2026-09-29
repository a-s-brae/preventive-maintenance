import { describe, expect, it } from "vitest";
import { addInterval, compareDue, computeDue, describeInterval, fixedOccurrence, nextFixedCycle, type ScheduleInput } from "./schedule";

const d = (s: string) => new Date(`${s}T12:00:00Z`);

const base: ScheduleInput = {
  calendarEvery: null,
  calendarUnit: null,
  usageEvery: null,
  scheduleBasis: "COMPLETION",
  startDate: d("2026-01-01"),
  fixedCycle: 0,
  startMeter: null,
  lastDoneAt: null,
  lastDoneMeter: null,
  dueSoonDays: 7,
};

describe("addInterval", () => {
  it("adds days and weeks", () => {
    expect(addInterval(d("2026-01-01"), 10, "DAY")).toEqual(d("2026-01-11"));
    expect(addInterval(d("2026-01-01"), 2, "WEEK")).toEqual(d("2026-01-15"));
  });

  it("clamps month-end", () => {
    expect(addInterval(d("2026-01-31"), 1, "MONTH")).toEqual(d("2026-02-28"));
    expect(addInterval(d("2028-01-31"), 1, "MONTH")).toEqual(d("2028-02-29"));
    expect(addInterval(d("2026-11-30"), 3, "MONTH")).toEqual(d("2027-02-28"));
  });

  it("adds years, including from Feb 29", () => {
    expect(addInterval(d("2028-02-29"), 1, "YEAR")).toEqual(d("2029-02-28"));
  });
});

describe("computeDue — calendar", () => {
  const monthly = { ...base, calendarEvery: 1, calendarUnit: "MONTH" as const, startDate: d("2026-02-01") };

  it("is first due on the start date", () => {
    const r = computeDue(monthly, null, d("2026-01-10"));
    expect(r.nextDueAt).toEqual(d("2026-02-01"));
    expect(r.status).toBe("OK");
  });

  it("uses last completion once done", () => {
    const r = computeDue({ ...monthly, lastDoneAt: d("2026-03-15") }, null, d("2026-03-20"));
    expect(r.nextDueAt).toEqual(d("2026-04-15"));
  });

  it("is due soon inside the lead window and on the due date", () => {
    expect(computeDue(monthly, null, d("2026-01-25")).status).toBe("DUE_SOON");
    expect(computeDue(monthly, null, d("2026-02-01")).status).toBe("DUE_SOON");
  });

  it("is overdue the day after the due date", () => {
    const r = computeDue(monthly, null, d("2026-02-02"));
    expect(r.status).toBe("OVERDUE");
    expect(r.daysLeft).toBe(-1);
  });
});

describe("due-soon window", () => {
  it("is capped at a quarter of the interval", () => {
    const weekly = { ...base, calendarEvery: 1, calendarUnit: "WEEK" as const, lastDoneAt: d("2026-03-01") };
    expect(computeDue(weekly, null, d("2026-03-01")).status).toBe("OK");
    expect(computeDue(weekly, null, d("2026-03-06")).status).toBe("OK");
    expect(computeDue(weekly, null, d("2026-03-07")).status).toBe("DUE_SOON");
  });

  it("makes daily tasks due soon only on the due date", () => {
    const daily = { ...base, calendarEvery: 1, calendarUnit: "DAY" as const, lastDoneAt: d("2026-03-01") };
    expect(computeDue(daily, null, d("2026-03-01")).status).toBe("OK");
    expect(computeDue(daily, null, d("2026-03-02")).status).toBe("DUE_SOON");
  });
});

describe("computeDue — usage", () => {
  const every250 = { ...base, usageEvery: 250, startMeter: 1000 };

  it("counts from start meter, then last completion meter", () => {
    expect(computeDue(every250, 1100).nextDueMeter).toBe(1250);
    expect(computeDue({ ...every250, lastDoneMeter: 1240 }, 1300).nextDueMeter).toBe(1490);
  });

  it("goes due soon in the last 10% and overdue at the limit", () => {
    expect(computeDue(every250, 1200).status).toBe("OK");
    expect(computeDue(every250, 1226).status).toBe("DUE_SOON");
    expect(computeDue(every250, 1250).status).toBe("OVERDUE");
  });

  it("is OK when no meter reading exists yet", () => {
    const r = computeDue(every250, null);
    expect(r.status).toBe("OK");
    expect(r.meterLeft).toBeNull();
  });
});

describe("computeDue — calendar + usage", () => {
  const both = { ...base, calendarEvery: 6, calendarUnit: "MONTH" as const, startDate: d("2026-07-01"), usageEvery: 500, startMeter: 0 };

  it("is overdue when usage is hit before the date", () => {
    expect(computeDue(both, 510, d("2026-02-01")).status).toBe("OVERDUE");
  });

  it("is overdue when the date passes before usage is hit", () => {
    expect(computeDue(both, 50, d("2026-08-01")).status).toBe("OVERDUE");
  });
});

describe("fixed schedules", () => {
  const fixed = { ...base, calendarEvery: 1, calendarUnit: "MONTH" as const, scheduleBasis: "FIXED" as const, startDate: d("2026-01-31") };

  it("stays on the calendar regardless of when it was done", () => {
    expect(computeDue({ ...fixed, fixedCycle: 2, lastDoneAt: d("2026-03-10") }, null, d("2026-03-10")).nextDueAt).toEqual(d("2026-03-31"));
  });

  it("doesn't drift at month end", () => {
    expect(fixedOccurrence(fixed.startDate, 1, "MONTH", 1)).toEqual(d("2026-02-28"));
    expect(fixedOccurrence(fixed.startDate, 1, "MONTH", 2)).toEqual(d("2026-03-31"));
  });

  it("moves to the next occurrence after completion", () => {
    // Feb 28 occurrence (cycle 1) done early on Feb 20 -> next is Mar 31.
    expect(nextFixedCycle(fixed, 1, d("2026-02-20"))).toBe(2);
    // Done on the due date itself -> still the following one.
    expect(nextFixedCycle(fixed, 1, d("2026-02-28"))).toBe(2);
  });

  it("skips occurrences already past when done late", () => {
    // Feb 28 occurrence done on Apr 2 -> Mar 31 is past, next is Apr 30.
    expect(nextFixedCycle(fixed, 1, d("2026-04-02"))).toBe(3);
  });
});

it("reports tasks with no interval", () => {
  expect(computeDue(base, null).status).toBe("NO_SCHEDULE");
});

it("sorts most urgent first", () => {
  const monthly = { ...base, calendarEvery: 1, calendarUnit: "MONTH" as const };
  const now = d("2026-01-28");
  const soon = computeDue({ ...monthly, startDate: d("2026-02-01") }, null, now);
  const overdue = computeDue({ ...monthly, startDate: d("2025-12-01") }, null, now);
  const ok = computeDue({ ...monthly, startDate: d("2026-02-27") }, null, now);
  expect([ok, soon, overdue].sort(compareDue)).toEqual([overdue, soon, ok]);
});

it("describes intervals", () => {
  expect(describeInterval({ calendarEvery: 1, calendarUnit: "WEEK", usageEvery: null }, null)).toBe("every week");
  expect(describeInterval({ calendarEvery: 3, calendarUnit: "MONTH", usageEvery: 500 }, "hours")).toBe(
    "every 3 months or every 500 hours",
  );
  expect(describeInterval({ calendarEvery: 1, calendarUnit: "MONTH", usageEvery: null, scheduleBasis: "FIXED" }, null)).toBe(
    "every month (fixed)",
  );
});
