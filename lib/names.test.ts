import { expect, it } from "vitest";
import { displayName, initials } from "./names";

it("shows a name, or one made from the email", () => {
  expect(displayName({ name: "Dana Ruiz", email: "d.ruiz@as-plastech.com" })).toBe("Dana Ruiz");
  expect(displayName({ name: "  ", email: "b.colegrove@as-plastech.com" })).toBe("B. Colegrove");
  expect(displayName({ email: "mary-jo_smith@as-plastech.com" })).toBe("Mary Jo Smith");
  expect(displayName({ name: null, email: "maintenance@as-plastech.com" })).toBe("Maintenance");
});

it("takes initials from the first and last word", () => {
  expect(initials("B. Colegrove")).toBe("BC");
  expect(initials("Mary Jo Smith")).toBe("MS");
  expect(initials("maintenance")).toBe("M");
  expect(initials("")).toBe("?");
});
