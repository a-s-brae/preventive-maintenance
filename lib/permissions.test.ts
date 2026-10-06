import { expect, it } from "vitest";
import { can } from "./permissions";

it("gives each role the right access", () => {
  expect(["report", "view", "work", "review", "manage", "people"].filter((p) => can("ADMIN", p as never))).toHaveLength(6);
  expect(can("TECH", "work")).toBe(true);
  expect(can("TECH", "view")).toBe(true);
  expect(can("TECH", "manage")).toBe(false);
  expect(can("TECH", "review")).toBe(false);
  expect(can("REQUESTER", "report")).toBe(true);
  expect(can("REQUESTER", "view")).toBe(false);
  expect(can("REQUESTER", "work")).toBe(false);
  expect(can(undefined, "report")).toBe(false);
});
