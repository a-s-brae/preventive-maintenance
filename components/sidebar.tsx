"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "./avatar";
import { Icon, type IconName } from "./icons";

export type Role = "ADMIN" | "TECH" | "REQUESTER";
export type Counts = { overdue: number; mine: number; pendingRequests: number; lowStock: number; unread: number };
export type PageLink = { href: string; title: string };

type Badge = { count: number; tone: "red" | "amber"; title: string };
type SubLink = { label: string; href: string; active: (path: string, view: string | null) => boolean };
type NavItem = { href: string; label: string; icon: IconName; badge?: Badge; paths?: string[]; children?: SubLink[] };

export function navGroups(counts: Counts, role: Role): { title: string; items: NavItem[] }[] {
  if (role === "REQUESTER") {
    return [
      {
        title: "Maintenance",
        items: [
          { href: "/", label: "Home", icon: "home" },
          { href: "/requests", label: "My requests", icon: "inbox" },
        ],
      },
    ];
  }
  return [
    {
      title: "Overview",
      items: [
        { href: "/", label: "Dashboard", icon: "pie" },
        { href: "/reports", label: "Reports", icon: "chart" },
      ],
    },
    {
      title: "Maintenance",
      items: [
        {
          href: "/work-orders",
          label: "Work orders",
          icon: "clipboard",
          badge: { count: counts.overdue, tone: "red", title: "overdue" },
          paths: ["/work-orders", "/history"],
          children: [
            { label: "Open", href: "/work-orders", active: (p, v) => p === "/work-orders" && (!v || v === "open") },
            { label: "Assigned to me", href: "/work-orders?view=mine", active: (p, v) => p === "/work-orders" && v === "mine" },
            { label: "Calendar", href: "/work-orders/calendar", active: (p) => p === "/work-orders/calendar" },
            { label: "Completed", href: "/work-orders?view=complete", active: (p, v) => (p === "/work-orders" && v === "complete") || p === "/history" },
          ],
        },
        { href: "/requests", label: "Requests", icon: "inbox", badge: { count: counts.pendingRequests, tone: "amber", title: "waiting for review" } },
        {
          href: "/pm",
          label: "PM schedules",
          icon: "repeat",
          paths: ["/pm", "/tasks", "/checklists"],
          // Checklist templates are set up by admins.
          children:
            role === "ADMIN"
              ? [
                  { label: "Schedules", href: "/pm", active: (p) => p === "/pm" || p.startsWith("/tasks/") },
                  { label: "Checklists", href: "/checklists", active: (p) => p.startsWith("/checklists") },
                ]
              : undefined,
        },
        {
          href: "/assets",
          label: "Equipment",
          icon: "cube",
          paths: ["/assets", "/locations"],
          children: [
            { label: "Assets", href: "/assets", active: (p) => p.startsWith("/assets") },
            { label: "Locations", href: "/locations", active: (p) => p.startsWith("/locations") },
          ],
        },
        { href: "/parts", label: "Parts", icon: "box", badge: { count: counts.lowStock, tone: "amber", title: "low or out of stock" } },
      ],
    },
    ...(role === "ADMIN" ? [{ title: "Admin", items: [{ href: "/people", label: "People", icon: "users" as const }] }] : []),
  ];
}

const inSection = (item: NavItem, path: string) =>
  item.href === "/" ? path === "/" : (item.paths ?? [item.href]).some((p) => path === p || path.startsWith(`${p}/`));

/** The left sidebar: favourites and recent pages on top, then the sections, with you at the bottom. */
export function Sidebar({
  role,
  counts,
  pathname,
  view,
  favorites,
  recent,
  user,
  signOutAction,
  onClose,
}: {
  role: Role;
  counts: Counts;
  pathname: string;
  /** The ?view= of the page, to pick the right work order view. */
  view: string | null;
  favorites: PageLink[];
  recent: PageLink[];
  user: { id: string; name: string; email: string };
  signOutAction?: () => Promise<void>;
  /** Shown in the phone drawer. */
  onClose?: () => void;
}) {
  const groups = navGroups(counts, role);
  const current = groups.flatMap((g) => g.items).find((i) => inSection(i, pathname));
  const currentHref = current?.children ? current.href : null;
  // Sections with sub-pages open by themselves when you go into them; the chevron opens or closes any.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(currentHref ? [currentHref] : []));
  useEffect(() => {
    if (currentHref) setExpanded((s) => (s.has(currentHref) ? s : new Set(s).add(currentHref)));
  }, [currentHref]);
  const toggle = (href: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (!next.delete(href)) next.add(href);
      return next;
    });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 pt-5 pb-4">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-sm font-medium text-ink">
          <span className="flex size-6 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white" aria-hidden="true">
            PM
          </span>
          <span className="truncate">PM System</span>
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close menu" className="btn-ghost">
            <Icon name="close" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-4 pb-4" aria-label="Main">
        {role !== "REQUESTER" && <QuickLinks favorites={favorites} recent={recent} />}
        {groups.map((group) => (
          <div key={group.title}>
            <div className="mb-1 px-2 text-sm text-neutral-500">{group.title}</div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const here = inSection(item, pathname);
                const open = !!item.children && expanded.has(item.href);
                const childHere = here && item.children?.some((c) => c.active(pathname, view));
                return (
                  <li key={item.href}>
                    <div className={`flex items-center rounded-lg ${here && !childHere ? "bg-neutral-100" : "hover:bg-neutral-50"}`}>
                      {item.children ? (
                        <button
                          type="button"
                          onClick={() => toggle(item.href)}
                          aria-expanded={open}
                          aria-label={`${open ? "Hide" : "Show"} ${item.label} pages`}
                          className="flex h-8 w-6 shrink-0 items-center justify-center rounded-l-lg text-neutral-400 hover:text-ink"
                        >
                          <Icon name="chevronRight" className={`size-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
                        </button>
                      ) : (
                        <span className="w-6 shrink-0" />
                      )}
                      <Link
                        href={item.href}
                        aria-current={here && !childHere ? "page" : undefined}
                        onClick={() => item.children && !open && toggle(item.href)}
                        className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-sm text-ink ${here ? "font-medium" : ""}`}
                      >
                        <Icon name={item.icon} />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && item.badge.count > 0 && (
                          <span
                            title={`${item.badge.count} ${item.badge.title}`}
                            className={`min-w-5 rounded-md px-1.5 text-center text-xs leading-5 font-medium ${
                              item.badge.tone === "red" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
                            }`}
                          >
                            {item.badge.count}
                          </span>
                        )}
                      </Link>
                    </div>
                    {open && (
                      <ul className="mt-0.5 space-y-0.5">
                        {item.children!.map((c) => {
                          const active = here && c.active(pathname, view);
                          return (
                            <li key={c.label}>
                              <Link
                                href={c.href}
                                aria-current={active ? "page" : undefined}
                                className={`block rounded-lg py-1.5 pr-2 pl-[3.25rem] text-sm text-ink ${active ? "bg-neutral-100" : "hover:bg-neutral-50"}`}
                              >
                                {c.label}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex items-center gap-2 border-t border-neutral-200/70 px-5 py-4">
        <Avatar name={user.name} seed={user.id} className="size-7 text-[11px]" />
        <div className="min-w-0 flex-1 text-sm">
          <div className="truncate text-ink">{user.name}</div>
          <div className="truncate text-xs text-neutral-500" title={user.email}>
            {signOutAction ? user.email : "Signed in with the team password"}
          </div>
        </div>
        {signOutAction && (
          <form action={signOutAction}>
            <button type="submit" className="btn-ghost text-neutral-500" aria-label="Sign out" title="Sign out">
              <Icon name="logout" className="size-[18px]" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/** "Favorites · Recently": pages you starred, and the records you opened last. */
function QuickLinks({ favorites, recent }: { favorites: PageLink[]; recent: PageLink[] }) {
  const [tab, setTab] = useState<"favorites" | "recent">("favorites");
  const list = tab === "favorites" ? favorites : recent;
  return (
    <div>
      <div className="mb-1 flex gap-4 px-2 text-sm" role="tablist" aria-label="Quick links">
        {(["favorites", "recent"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={tab === t ? "text-ink" : "text-neutral-500 hover:text-ink"}
          >
            {t === "favorites" ? "Favorites" : "Recently"}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <p className="px-2 py-1 text-xs text-neutral-500">
          {tab === "favorites" ? "Star a page (☆ at the top) to keep it here." : "Work orders and equipment you open show up here."}
        </p>
      ) : (
        <ul className="space-y-0.5" role="tabpanel">
          {list.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-neutral-50" title={l.title}>
                <span className="size-1.5 shrink-0 rounded-full bg-neutral-300" aria-hidden="true" />
                <span className="truncate">{l.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
