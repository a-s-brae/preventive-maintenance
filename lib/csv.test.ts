import { expect, it } from "vitest";
import { toCsv } from "./csv";

it("stops text cells running as spreadsheet formulas, even after spaces", () => {
  const row = (v: string) => toCsv(["a"], [[v]]).split("\r\n")[1];
  expect(row("=1+1")).toBe("'=1+1");
  expect(row("  =HYPERLINK(1)")).toBe("'  =HYPERLINK(1)");
  expect(row("\t@SUM(1)")).toBe("'\t@SUM(1)");
  expect(row("Belt, 3V")).toBe('"Belt, 3V"');
  expect(row("plain")).toBe("plain");
});
