// Relative times for activity feeds.

export const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "Just now", "59 minutes ago", "Today, 11:59 AM", "Feb 2, 2026" — in the viewer's time zone. */
export function timeAgo(date: Date, now: Date, timeZone?: string): string {
  const ms = now.getTime() - date.getTime();
  if (ms < MINUTE) return "Just now";
  if (ms < HOUR) {
    const m = Math.floor(ms / MINUTE);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (ms < 12 * HOUR) {
    const h = Math.floor(ms / HOUR);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const day = (d: Date) => d.toLocaleDateString("en-US", { timeZone });
  const time = date.toLocaleTimeString("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  if (day(date) === day(now)) return `Today, ${time}`;
  if (day(date) === day(new Date(now.getTime() - 24 * HOUR))) return `Yesterday, ${time}`;
  return date.toLocaleDateString("en-US", { timeZone, month: "short", day: "numeric", year: "numeric" });
}
