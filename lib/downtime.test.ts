import { expect, it } from "vitest";
import { downtimeHours, formatDuration, requestNumber } from "./downtime";

const t = (s: string) => new Date(`2026-03-${s}Z`);

it("sums downtime inside a window, clipping at the edges", () => {
  const periods = [
    { startedAt: t("01T08:00"), endedAt: t("01T12:00") }, // 4 h, before the window starts at 10:00 → 2 h
    { startedAt: t("02T00:00"), endedAt: t("02T01:30") }, // 1.5 h inside
    { startedAt: t("05T00:00"), endedAt: t("06T00:00") }, // after the window
  ];
  expect(downtimeHours(periods, t("01T10:00"), t("03T00:00"))).toBeCloseTo(3.5);
});

it("counts open downtime up to now", () => {
  expect(downtimeHours([{ startedAt: t("01T00:00"), endedAt: null }], t("01T00:00"), t("31T00:00"), t("01T06:00"))).toBeCloseTo(6);
});

it("formats durations", () => {
  expect(formatDuration(0.75)).toBe("45 min");
  expect(formatDuration(3 + 1 / 3)).toBe("3 h 20 min");
  expect(formatDuration(5)).toBe("5 h");
  expect(formatDuration(52)).toBe("2 d 4 h");
  expect(formatDuration(48)).toBe("2 d");
});

it("numbers requests", () => {
  expect(requestNumber(3)).toBe("REQ-0003");
});
