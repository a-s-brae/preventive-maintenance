import { expect, it } from "vitest";
import { isAllowedEmail } from "./email-domains";

it("only lets in company addresses with exactly one @", () => {
  expect(isAllowedEmail("pat@as-plastech.com")).toBe(true);
  expect(isAllowedEmail("pat@as-plastech.com@evil.com")).toBe(false);
  expect(isAllowedEmail("pat@evil.com@as-plastech.com")).toBe(false);
  expect(isAllowedEmail("@as-plastech.com")).toBe(false);
  expect(isAllowedEmail("pat@evil.com")).toBe(false);
});
