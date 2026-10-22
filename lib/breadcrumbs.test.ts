import { expect, it } from "vitest";
import { crumbs } from "./breadcrumbs";

const trail = (path: string, role: "ADMIN" | "TECH" | "REQUESTER" = "ADMIN") => crumbs(path, role).map((c) => c.label).join(" / ");

it("names sections by their group, and pages by their section", () => {
  expect(trail("/")).toBe("Overview / Dashboard");
  expect(trail("/work-orders")).toBe("Maintenance / Work orders");
  expect(trail("/work-orders/abc123")).toBe("Work orders / Work order");
  expect(trail("/work-orders/abc123/edit")).toBe("Work orders / Edit work order");
  expect(trail("/work-orders/calendar")).toBe("Work orders / Calendar");
  expect(trail("/history")).toBe("Work orders / Completed");
  expect(trail("/locations")).toBe("Equipment / Locations");
  expect(trail("/assets/new")).toBe("Equipment / New asset");
  expect(trail("/assets/abc/tasks/new")).toBe("Equipment / New PM schedule");
  expect(trail("/tasks/abc/edit")).toBe("PM schedules / Edit PM schedule");
  expect(trail("/requests/new")).toBe("Requests / Report a problem");
  expect(trail("/people/digest")).toBe("People / Daily email");
  expect(trail("/search")).toBe("Search");
  expect(trail("/help")).toBe("Help & guide");
  expect(trail("/nowhere")).toBe("");
});

it("keeps requesters to their own pages", () => {
  expect(trail("/", "REQUESTER")).toBe("Home");
  expect(trail("/requests", "REQUESTER")).toBe("My requests");
  expect(trail("/requests/new", "REQUESTER")).toBe("My requests / Report a problem");
  expect(trail("/help", "REQUESTER")).toBe("Help & guide");
  expect(trail("/notifications", "REQUESTER")).toBe("Notifications");
  expect(crumbs("/work-orders", "ADMIN")[1].href).toBeUndefined();
  expect(crumbs("/work-orders/x", "ADMIN")[0].href).toBe("/work-orders");
});
