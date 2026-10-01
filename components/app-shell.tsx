"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Counts = { overdue: number; mine: number };

type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: { count: number; tone: "red" | "blue"; title: string } };

function navSections(counts: Counts): { title?: string; items: NavItem[] }[] {
  return [
    { items: [{ href: "/", label: "Dashboard", icon: "home" }] },
    {
      title: "Work orders",
      items: [
        { href: "/work-orders", label: "Open", icon: "clipboard", badge: { count: counts.overdue, tone: "red", title: "overdue" } },
        { href: "/work-orders?view=mine", label: "Assigned to me", icon: "user", badge: { count: counts.mine, tone: "blue", title: "open, assigned to you" } },
        { href: "/work-orders/calendar", label: "Calendar", icon: "calendar" },
        { href: "/history", label: "History", icon: "clock" },
      ],
    },
    {
      title: "Planning",
      items: [
        { href: "/pm", label: "PM schedules", icon: "repeat" },
        { href: "/assets", label: "Assets", icon: "cube" },
      ],
    },
  ];
}

/** Sidebar on large screens; a top bar with a slide-out menu on phones and tablets. */
export function AppShell({
  email,
  counts,
  signOutAction,
  children,
}: {
  email: string;
  counts: Counts;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  // Close the menu after navigating.
  useEffect(() => setOpen(false), [pathname]);
  // Esc closes the menu.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2 px-5 py-5 text-base font-semibold text-white">
        <span className="flex size-7 items-center justify-center rounded-md bg-sky-600 text-xs font-bold">PM</span>
        PM System
      </Link>
      <Suspense fallback={<Nav counts={counts} />}>
        <ActiveNav counts={counts} />
      </Suspense>
      <form action={signOutAction} className="border-t border-white/10 px-5 py-4 text-sm">
        <div className="truncate text-slate-400" title={email}>
          {email}
        </div>
        <button type="submit" className="mt-1 text-slate-200 hover:text-white hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <>
      <aside className="fixed inset-y-0 left-0 hidden w-60 bg-slate-900 lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-slate-900 px-4 text-white lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="-ml-1 rounded-md p-1.5 hover:bg-white/10">
          <Icon name="menu" />
        </button>
        <Link href="/" className="font-semibold">
          PM System
        </Link>
        {counts.overdue > 0 && (
          <Link href="/work-orders?due=overdue" className="ml-auto rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium">
            {counts.overdue} overdue
          </Link>
        )}
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-slate-900 shadow-xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute top-4 right-3 rounded-md p-1.5 text-slate-300 hover:bg-white/10">
              <Icon name="close" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </>
  );
}

function ActiveNav({ counts }: { counts: Counts }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (path === "/") return pathname === "/";
    if (path === "/work-orders" && pathname === "/work-orders") {
      // "Open" and "Assigned to me" share a path; tell them apart by view.
      return (new URLSearchParams(query).get("view") ?? "open") === (params.get("view") ?? "open");
    }
    if (path === "/work-orders") return /^\/work-orders\/(?!calendar)/.test(pathname);
    return pathname === path || pathname.startsWith(`${path}/`) || (path === "/assets" && pathname.startsWith("/tasks/"));
  };
  return <Nav counts={counts} isActive={isActive} />;
}

function Nav({ counts, isActive = () => false }: { counts: Counts; isActive?: (href: string) => boolean }) {
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4" aria-label="Main">
      {navSections(counts).map((section, i) => (
        <div key={i}>
          {section.title && <div className="mb-1 px-2 text-xs font-medium tracking-wide text-slate-400 uppercase">{section.title}</div>}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm ${
                      active ? "bg-white/10 font-medium text-white" : "text-slate-300 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <Icon name={item.icon} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && item.badge.count > 0 && (
                      <span
                        title={`${item.badge.count} ${item.badge.title}`}
                        className={`min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-medium text-white ${item.badge.tone === "red" ? "bg-red-600" : "bg-sky-600"}`}
                      >
                        {item.badge.count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

// Simple outline icons (24×24, stroke).
const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  clipboard: "M9 4h6m-6 0a2 2 0 0 0-2 2H5v15h14V6h-2a2 2 0 0 0-2-2M9 4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M8 12h8M8 16h5",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m-7 9a7 7 0 0 1 14 0",
  calendar: "M4 6h16v15H4zm0 4h16M8 3v4m8-4v4",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18m0-13v5l3 2",
  repeat: "M4 12a8 8 0 0 1 13.7-5.6L20 9M20 4v5h-5m5 3a8 8 0 0 1-13.7 5.6L4 15m0 5v-5h5",
  cube: "m12 3 8 4.5v9L12 21l-8-4.5v-9zm0 0v18m8-13.5-8 4.5-8-4.5",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="size-5 shrink-0" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}
