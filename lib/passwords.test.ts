import { expect, it } from "vitest";
import { passwordProblem } from "./forms";
import { hashPassword, verifyAgainstDecoy, verifyPassword } from "./passwords";

it("checks a password against its hash", async () => {
  const hash = await hashPassword("belts and bearings");
  expect(hash).toMatch(/^scrypt\$[^$]+\$[^$]+$/);
  expect(hash).not.toContain("belts");
  expect(await verifyPassword("belts and bearings", hash)).toBe(true);
  expect(await verifyPassword("belts and bearing", hash)).toBe(false);
  expect(await verifyPassword("Belts and bearings", hash)).toBe(false);
  expect(await verifyPassword("", hash)).toBe(false);
});

it("salts every hash", async () => {
  expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
});

it("refuses malformed hashes and the decoy", async () => {
  expect(await verifyPassword("anything at all", "")).toBe(false);
  expect(await verifyPassword("anything at all", "plain$abc$def")).toBe(false);
  expect(await verifyAgainstDecoy("anything at all")).toBe(false);
});

it("asks for a reasonable length", () => {
  expect(passwordProblem("short")).toMatch(/at least/);
  expect(passwordProblem("long enough pw")).toBe(null);
  expect(passwordProblem("x".repeat(201))).toMatch(/at most/);
});
