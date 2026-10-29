import { expect, it } from "vitest";
import { passwordMatches, teamPassword } from "./team-password";

it("is on only while TEAM_PASSWORD is set", () => {
  expect(teamPassword({})).toBe(null);
  expect(teamPassword({ TEAM_PASSWORD: "" })).toBe(null);
  expect(teamPassword({ TEAM_PASSWORD: "pumps and belts" })).toBe("pumps and belts");
});

it("matches the password exactly", () => {
  expect(passwordMatches("pumps and belts", "pumps and belts")).toBe(true);
  expect(passwordMatches("pumps and belt", "pumps and belts")).toBe(false);
  expect(passwordMatches("pumps and beltz", "pumps and belts")).toBe(false);
  expect(passwordMatches("", "pumps and belts")).toBe(false);
  expect(passwordMatches("Pumps and belts", "pumps and belts")).toBe(false);
  expect(passwordMatches("pässwörd ✓", "pässwörd ✓")).toBe(true);
});
