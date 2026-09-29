import { expect, it } from "vitest";
import { woNumber, workOrderDue } from "./work-orders";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const now = d("2026-03-10");
const open = { status: "OPEN" as const, dueDate: null, dueMeter: null };

it("rates open work orders by due date", () => {
  expect(workOrderDue({ ...open, dueDate: d("2026-03-09") }, null, null, now)).toMatchObject({ status: "OVERDUE", daysLeft: -1 });
  expect(workOrderDue({ ...open, dueDate: d("2026-03-17") }, null, null, now).status).toBe("DUE_SOON");
  expect(workOrderDue({ ...open, dueDate: d("2026-03-18") }, null, null, now).status).toBe("OK");
  expect(workOrderDue(open, null, null, now).status).toBe("NO_SCHEDULE");
});

it("rates usage PM work orders by meter", () => {
  const wo = { ...open, dueMeter: 12_700 };
  expect(workOrderDue(wo, 12_400, 2000, now)).toMatchObject({ status: "OK", meterLeft: 300 });
  expect(workOrderDue(wo, 12_500, 2000, now).status).toBe("DUE_SOON");
  expect(workOrderDue(wo, 12_700, 2000, now).status).toBe("OVERDUE");
});

it("treats completed work orders as done", () => {
  expect(workOrderDue({ ...open, status: "COMPLETE", dueDate: d("2020-01-01") }, null, null, now).status).toBe("OK");
});

it("formats numbers", () => {
  expect(woNumber(7)).toBe("WO-0007");
  expect(woNumber(12345)).toBe("WO-12345");
});
