import { expect, it } from "vitest";
import { timeAgo } from "./time";

const now = new Date("2026-10-22T18:30:00Z");
const ago = (ms: number) => timeAgo(new Date(now.getTime() - ms), now, "UTC");

it("says how long ago, then the day", () => {
  expect(ago(20_000)).toBe("Just now");
  expect(ago(60_000)).toBe("1 minute ago");
  expect(ago(59 * 60_000)).toBe("59 minutes ago");
  expect(ago(3 * 3_600_000)).toBe("3 hours ago");
  expect(ago(13 * 3_600_000)).toBe("Today, 5:30 AM");
  expect(ago(20 * 3_600_000)).toBe("Yesterday, 10:30 PM");
  expect(ago(30 * 86_400_000)).toBe("Sep 22, 2026");
});
