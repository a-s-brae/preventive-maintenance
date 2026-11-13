import { expect, it } from "vitest";
import { clientIp, EMAIL_LIMIT, IP_LIMIT, isLimited } from "./sign-in-limits";

it("waits after too many wrong passwords for one email or from one address", () => {
  expect(isLimited({ email: 0, ip: 0 })).toBe(false);
  expect(isLimited({ email: EMAIL_LIMIT - 1, ip: IP_LIMIT - 1 })).toBe(false);
  expect(isLimited({ email: EMAIL_LIMIT, ip: 0 })).toBe(true);
  expect(isLimited({ email: 0, ip: IP_LIMIT })).toBe(true);
});

it("reads the visitor's address", () => {
  expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
  expect(clientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  expect(clientIp(new Headers())).toBe("unknown");
});
