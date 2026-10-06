import { expect, it } from "vitest";
import { entryMinutes, formatMinutes, minutesBetween, totalMinutes } from "./labor";
import { formatMoney, partsCost, roundQty, stockAlert, stockStatus } from "./parts";

it("rates stock levels", () => {
  expect(stockStatus({ quantity: 0, minQuantity: 2 })).toBe("OUT");
  expect(stockStatus({ quantity: -1, minQuantity: null })).toBe("OUT");
  expect(stockStatus({ quantity: 2, minQuantity: 2 })).toBe("LOW");
  expect(stockStatus({ quantity: 3, minQuantity: 2 })).toBe("OK");
  expect(stockStatus({ quantity: 1, minQuantity: null })).toBe("OK");
});

it("rounds quantities and totals part costs", () => {
  expect(roundQty(0.1 + 0.2)).toBe(0.3);
  expect(partsCost([{ quantity: 2, unitCost: 12.5 }, { quantity: 1.5, unitCost: null }, { quantity: 0.5, unitCost: 4 }])).toBe(27);
  expect(formatMoney(27)).toBe("$27.00");
  expect(formatMoney(null)).toBe("—");
});

it("counts labor minutes", () => {
  const t = (m: number) => new Date(Date.UTC(2026, 9, 6, 8, m));
  expect(minutesBetween(t(0), t(0))).toBe(1);
  expect(minutesBetween(t(0), t(44))).toBe(44);
  expect(entryMinutes({ minutes: null, startedAt: t(0), endedAt: null }, t(30))).toBe(30);
  expect(totalMinutes([{ minutes: 90, startedAt: t(0), endedAt: t(90) }, { minutes: null, startedAt: t(0), endedAt: null }], t(15))).toBe(105);
  expect(formatMinutes(45)).toBe("45 min");
  expect(formatMinutes(65)).toBe("1 h 05 min");
  expect(formatMinutes(180)).toBe("3 h");
});

it("alerts only when stock drops into low or out", () => {
  const part = (quantity: number) => ({ id: "p", name: "Filter", unit: "ea", quantity, minQuantity: 2 });
  expect(stockAlert(part(5), part(3))).toBe(null);
  expect(stockAlert(part(3), part(2))).toEqual({ title: "Low stock: Filter", body: "2 ea left (reorder at 2)", href: "/parts/p" });
  expect(stockAlert(part(2), part(1))).toBe(null); // already low
  expect(stockAlert(part(1), part(0))?.title).toBe("Out of stock: Filter");
  expect(stockAlert(part(0), part(1))).toBe(null); // restocked a little: still low, but better
  expect(stockAlert(part(1), part(5))).toBe(null);
});
