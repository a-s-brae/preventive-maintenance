import { expect, it, vi } from "vitest";

// buildDigest is pure; keep the database out of the test.
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/queries", () => ({ getOpenWorkOrders: async () => [] }));
const { buildDigest } = await import("./digest");

const base = { name: "Sam", baseUrl: "http://pm.local" };
const item = { number: 7, title: "Change oil <filter>", asset: "Compressor", due: "Oct 3", overdue: true, url: "http://pm.local/work-orders/x" };

it("sends nothing when there's nothing to report", () => {
  expect(buildDigest({ ...base, role: "TECH", mine: [] })).toBeNull();
  expect(buildDigest({ ...base, role: "ADMIN", mine: [], summary: { overdue: 0, down: [], pendingRequests: 0, lowStock: [] } })).toBeNull();
});

it("lists a tech's work and flags overdue", () => {
  const d = buildDigest({ ...base, role: "TECH", mine: [item, { ...item, number: 8, overdue: false }] })!;
  expect(d.subject).toBe("2 work orders need you (1 overdue)");
  expect(d.text).toContain("WO-0007 Change oil <filter> (Compressor) — OVERDUE, due Oct 3");
  expect(d.html).toContain("Change oil &lt;filter&gt;"); // escaped
});

it("gives admins the plant summary", () => {
  const d = buildDigest({ ...base, role: "ADMIN", mine: [], summary: { overdue: 3, down: ["Press 2"], pendingRequests: 1, lowStock: ["Oil filter"] } })!;
  expect(d.subject).toBe("Maintenance summary: 3 overdue, 1 down, 1 requests");
  expect(d.text).toContain("Down: Press 2");
  expect(d.text).toContain("Low on stock: Oil filter");
});
