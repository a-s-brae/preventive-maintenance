import { expect, it } from "vitest";
import { buckets, completedByBucket, formatHours, parseRange, pmCompliance, pmOutcome, reliability, type PmWorkOrder } from "./reports";

const d = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00Z` : s);
const now = new Date("2026-10-06T15:00:00Z");

it("reads the date range", () => {
  const r = parseRange({}, now);
  expect(r.preset).toBe("90");
  expect(r.fromInput).toBe("2026-07-09");
  expect(r.toInput).toBe("2026-10-06");
  expect(r.to.toISOString()).toBe("2026-10-07T00:00:00.000Z");

  expect(parseRange({ range: "ytd" }, now).fromInput).toBe("2026-01-01");
  const c = parseRange({ range: "custom", from: "2026-09-30", to: "2026-09-01" }, now);
  expect([c.fromInput, c.toInput, c.preset]).toEqual(["2026-09-01", "2026-09-30", "custom"]);
  expect(parseRange({ range: "custom", from: "nope" }, now).preset).toBe("90");
});

it("scores PM compliance", () => {
  const range = parseRange({ range: "30" }, now);
  const pm = (p: Partial<PmWorkOrder>): PmWorkOrder => ({ assetId: "a", status: "COMPLETE", dueDate: null, dueMeter: null, completedAt: null, meterReading: null, ...p });
  const wos = [
    pm({ dueDate: d("2026-09-20"), completedAt: d("2026-09-20") }), // on time (same day)
    pm({ dueDate: d("2026-09-20"), completedAt: d("2026-09-22") }), // late
    pm({ dueDate: d("2026-10-01"), status: "OPEN" }), // missed
    pm({ dueDate: d("2026-10-10"), status: "OPEN" }), // not due yet
    pm({ dueDate: d("2026-08-01"), completedAt: d("2026-09-10") }), // due before the range
    pm({ dueMeter: 500, meterReading: 510, completedAt: d("2026-09-15") }), // usage, late
    pm({ dueMeter: 500, meterReading: 495, completedAt: d("2026-09-16") }), // usage, on time
  ];
  expect(pmOutcome(wos[3], range, now)).toBe(null);
  expect(pmCompliance(wos, range, now)).toEqual({ due: 5, onTime: 2, late: 2, missed: 1, percent: 40 });
  expect(pmCompliance([], range, now).percent).toBe(null);
});

it("works out downtime, MTTR and MTBF", () => {
  const range = parseRange({ range: "30" }, now); // 2026-09-07 → now
  const r = reliability(
    [
      { assetId: "a", startedAt: d("2026-09-01T00:00:00Z"), endedAt: d("2026-09-08T00:00:00Z") }, // started before: 24 h in range, not a failure
      { assetId: "a", startedAt: d("2026-09-20T08:00:00Z"), endedAt: d("2026-09-20T12:00:00Z") }, // 4 h
      { assetId: "b", startedAt: d("2026-10-06T13:00:00Z"), endedAt: null }, // still down: 2 h so far
    ],
    range,
    now,
    2,
  );
  expect(r.failures).toBe(2);
  expect(r.downHours).toBe(30);
  expect(r.mttrHours).toBe((168 + 4) / 2);
  const elapsed = 29 * 24 + 15;
  expect(r.mtbfHours).toBe((2 * elapsed - 30) / 2);
  expect(reliability([], range, now, 3)).toMatchObject({ failures: 0, mttrHours: null, mtbfHours: null });
});

it("buckets by week or month", () => {
  const weeks = buckets(parseRange({ range: "30" }, now));
  expect(weeks[0].start.toISOString().slice(0, 10)).toBe("2026-09-07"); // a Monday
  expect(weeks.at(-1)!.label).toBe("Oct 5");
  const months = buckets(parseRange({ range: "365" }, now));
  expect(months.map((b) => b.label).slice(0, 4)).toEqual(["Oct 25", "Nov", "Dec", "Jan 26"]);
  expect(months).toHaveLength(13);

  const counted = completedByBucket(
    [
      { type: "PM", completedAt: d("2026-09-08") },
      { type: "REPAIR", completedAt: d("2026-09-09") },
      { type: "PM", completedAt: null },
    ],
    weeks,
  );
  expect(counted[0].counts).toEqual({ PM: 1, INSPECTION: 0, REPAIR: 1 });
  expect(counted[0].total).toBe(2);
});

it("formats hours", () => {
  expect(formatHours(1.26)).toBe("1.3 h");
  expect(formatHours(36.4)).toBe("36 h");
  expect(formatHours(100)).toBe("4 d");
  expect(formatHours(null)).toBe("—");
  expect(formatHours(0.01)).toBe("<0.1 h");
  expect(formatHours(0)).toBe("0 h");
});
