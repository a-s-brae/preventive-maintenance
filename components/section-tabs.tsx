// The tabs inside each sidebar section, so related pages sit together:
// one "Work orders" link instead of four, "Equipment" for assets and locations,
// "PM schedules" for schedules and checklist templates.
import { Tabs } from "./ui";

export function WorkOrderTabs({ active }: { active: "open" | "mine" | "calendar" | "complete" }) {
  return (
    <Tabs
      label="Work order views"
      active={active}
      tabs={[
        { key: "open", label: "Open", href: "/work-orders" },
        { key: "mine", label: "Assigned to me", href: "/work-orders?view=mine" },
        { key: "calendar", label: "Calendar", href: "/work-orders/calendar" },
        { key: "complete", label: "Completed", href: "/work-orders?view=complete" },
      ]}
    />
  );
}

export function EquipmentTabs({ active }: { active: "assets" | "locations" }) {
  return (
    <Tabs
      label="Equipment"
      active={active}
      tabs={[
        { key: "assets", label: "Assets", href: "/assets" },
        { key: "locations", label: "Locations", href: "/locations" },
      ]}
    />
  );
}

/** Checklist templates are set up by admins, so techs see no tabs here. */
export function PmTabs({ active, showChecklists }: { active: "schedules" | "checklists"; showChecklists: boolean }) {
  return (
    <Tabs
      label="PM schedules"
      active={active}
      tabs={[
        { key: "schedules", label: "Schedules", href: "/pm" },
        ...(showChecklists ? [{ key: "checklists", label: "Checklist templates", href: "/checklists" }] : []),
      ]}
    />
  );
}
