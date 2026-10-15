import { expect, it } from "vitest";
import { parseBasicAuth, passwordMatches, teamPassword } from "./team-password";

const basic = (s: string) => `Basic ${Buffer.from(s, "utf8").toString("base64")}`;

it("is on only while TEAM_PASSWORD is set", () => {
  expect(teamPassword({})).toBe(null);
  expect(teamPassword({ TEAM_PASSWORD: "" })).toBe(null);
  expect(teamPassword({ TEAM_PASSWORD: "pumps and belts" })).toBe("pumps and belts");
});

it("reads the email and password the browser sends", () => {
  expect(parseBasicAuth(basic(" B.Colegrove@AS-Plastech.com :s3cret:with:colons"))).toEqual({
    email: "b.colegrove@as-plastech.com",
    password: "s3cret:with:colons",
  });
  expect(parseBasicAuth(basic("tech@as-plastech.com:pässwörd ✓"))).toEqual({ email: "tech@as-plastech.com", password: "pässwörd ✓" });
  expect(parseBasicAuth(null)).toBe(null);
  expect(parseBasicAuth("Bearer abc")).toBe(null);
  expect(parseBasicAuth("Basic !!!")).toBe(null);
  expect(parseBasicAuth(basic("no-colon"))).toBe(null);
  expect(parseBasicAuth(basic(":password-only"))).toBe(null);
  expect(parseBasicAuth(`Basic ${Buffer.from([0x61, 0x3a, 0xff]).toString("base64")}`)).toBe(null); // not UTF-8
});

it("matches the password exactly", () => {
  expect(passwordMatches("pumps and belts", "pumps and belts")).toBe(true);
  expect(passwordMatches("pumps and belt", "pumps and belts")).toBe(false);
  expect(passwordMatches("pumps and beltz", "pumps and belts")).toBe(false);
  expect(passwordMatches("", "pumps and belts")).toBe(false);
  expect(passwordMatches("Pumps and belts", "pumps and belts")).toBe(false);
});
