import { expect, it } from "vitest";
import { loginHref, safeNext } from "./sign-in";

it("only goes back to pages on this site", () => {
  expect(safeNext("/work-orders/abc?tab=parts")).toBe("/work-orders/abc?tab=parts");
  expect(safeNext("/a/xyz")).toBe("/a/xyz");
  expect(safeNext("https://evil.example")).toBe("/");
  expect(safeNext("//evil.example")).toBe("/");
  expect(safeNext("/\\evil.example")).toBe("/");
  expect(safeNext("/\t/evil.example")).toBe("/");
  expect(safeNext("/\n/evil.example")).toBe("/");
  expect(safeNext("/\r/evil.example")).toBe("/");
  expect(safeNext("/a\\..\\evil")).toBe("/");
  expect(safeNext("/login?next=/x")).toBe("/");
  expect(safeNext(undefined)).toBe("/");
  expect(safeNext(42)).toBe("/");
});

it("sends signed-out people to sign in, then back", () => {
  expect(loginHref("/a/xyz")).toBe("/login?next=%2Fa%2Fxyz");
  expect(loginHref("/")).toBe("/login");
  expect(loginHref(null)).toBe("/login");
  expect(loginHref("//evil.example")).toBe("/login");
});
