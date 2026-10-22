// The trail in the top bar ("Work orders / Edit work order"), from the URL alone.
import type { Role } from "@prisma/client";

type Section = { label: string; href: string; group?: string; one?: string };
const SECTIONS: Record<string, Section> = {
  "work-orders": { label: "Work orders", href: "/work-orders", group: "Maintenance", one: "work order" },
  history: { label: "Work orders", href: "/work-orders", group: "Maintenance" },
  requests: { label: "Requests", href: "/requests", group: "Maintenance", one: "request" },
  pm: { label: "PM schedules", href: "/pm", group: "Maintenance" },
  tasks: { label: "PM schedules", href: "/pm", group: "Maintenance", one: "PM schedule" },
  checklists: { label: "PM schedules", href: "/pm", group: "Maintenance", one: "checklist" },
  assets: { label: "Equipment", href: "/assets", group: "Maintenance", one: "asset" },
  locations: { label: "Equipment", href: "/assets", group: "Maintenance", one: "location" },
  parts: { label: "Parts", href: "/parts", group: "Maintenance", one: "part" },
  reports: { label: "Reports", href: "/reports", group: "Overview" },
  people: { label: "People", href: "/people", group: "Admin" },
  notifications: { label: "Notifications", href: "/notifications" },
  search: { label: "Search", href: "/search" },
  help: { label: "Help & guide", href: "/help" },
};
/** Pages named after their own path segment. */
const PAGES: Record<string, string> = { history: "Completed", checklists: "Checklists", locations: "Locations", calendar: "Calendar", import: "Import", digest: "Daily email" };

export function crumbs(pathname: string, role: Role): { label: string; href?: string }[] {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length === 0) return role === "REQUESTER" ? [{ label: "Home" }] : [{ label: "Overview" }, { label: "Dashboard" }];
  const sec = SECTIONS[seg[0]];
  if (!sec) return [];
  if (role === "REQUESTER" && seg[0] === "requests") {
    return [{ label: "My requests", href: "/requests" }, ...(seg.length > 1 ? [{ label: seg[1] === "new" ? "Report a problem" : "Request" }] : [])];
  }
  if (seg.length === 1) {
    const own = PAGES[seg[0]];
    return own ? [{ label: sec.label, href: sec.href }, { label: own }] : [...(sec.group ? [{ label: sec.group }] : []), { label: sec.label }];
  }
  const last = seg[seg.length - 1];
  const thing = seg.includes("tasks") ? "PM schedule" : (sec.one ?? "page");
  const label =
    PAGES[last] ??
    (last === "new" ? (seg[0] === "requests" ? "Report a problem" : `New ${thing}`) : last === "edit" ? `Edit ${thing}` : thing[0].toUpperCase() + thing.slice(1));
  return [{ label: sec.label, href: sec.href }, { label }];
}
