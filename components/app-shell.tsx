"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { finishWelcome } from "@/lib/actions";
import { crumbs } from "@/lib/breadcrumbs";
import { Icon } from "./icons";
import { Tour, tourSteps, Welcome } from "./onboarding";
import { Sidebar, type Counts, type PageLink, type Role } from "./sidebar";

const DEFAULT_FAVORITES: PageLink[] = [
  { href: "/work-orders?view=mine", title: "Assigned to me" },
  { href: "/work-orders?due=overdue", title: "Overdue work" },
];
/** Record pages that go in "Recently". */
const RECORD = /^\/(work-orders|assets|parts|requests|locations|tasks|checklists)\/(?!new$|import$|calendar$|export$)[^/]+$/;

// Favourites and recent pages are a per-browser convenience; storage may be blocked.
function readList(key: string): PageLink[] | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    if (!Array.isArray(v)) return null;
    return v.filter((x): x is PageLink => typeof x?.href === "string" && x.href.startsWith("/") && typeof x?.title === "string");
  } catch {
    return null;
  }
}
function writeList(key: string, list: PageLink[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
}
/** Panel choices live in cookies so the server draws the page the same way next time. */
function remember(name: string, open: boolean) {
  document.cookie = `${name}=${open ? "open" : "closed"}; path=/; max-age=31536000; samesite=lax`;
}

/** Below this width the activity panel stays closed unless you open it. */
const RAIL_AUTO = "min-[1440px]:block";

/** The page's name: its heading, plus (for favourites) the tab and filters that are on. */
function pageTitle(withFilters: boolean): string | null {
  const main = document.getElementById("main");
  const h1 = main?.querySelector("h1")?.textContent?.trim();
  if (!main || !h1) return null;
  if (!withFilters) return h1;
  const on = [main.querySelector('nav [aria-current="page"]'), ...main.querySelectorAll('[aria-pressed="true"]')].map((e) => e?.textContent?.trim());
  return [h1, ...on].filter((x, i, all): x is string => !!x && all.indexOf(x) === i).join(" · ");
}

/** Sidebar, top bar and (for staff) the activity panel around every page. */
export function AppShell({
  user,
  role,
  counts,
  signOutAction,
  rail,
  initialSidebar,
  initialRail,
  welcome,
  children,
}: {
  user: { id: string; name: string; email: string };
  role: Role;
  counts: Counts;
  /** Absent with team password sign-in, where the browser holds the sign-in. */
  signOutAction?: () => Promise<void>;
  /** The right-hand panel (staff only). */
  rail?: React.ReactNode;
  initialSidebar: boolean;
  /** "auto": shown on wide screens only. */
  initialRail: "auto" | "open" | "closed";
  /** They haven't had the welcome (and tour) for their role yet. */
  welcome: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const staff = role !== "REQUESTER";

  const [drawer, setDrawer] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebar);
  const [railMode, setRailMode] = useState(initialRail);
  // "auto" shows the panel on wide screens only (where it leaves the page enough room).
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1440px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const railShown = railMode === "open" || (railMode === "auto" && wide);
  const [favorites, setFavorites] = useState<PageLink[]>(DEFAULT_FAVORITES);
  const [recent, setRecent] = useState<PageLink[]>([]);

  useEffect(() => {
    setFavorites(readList("pm-favorites") ?? DEFAULT_FAVORITES);
    setRecent(readList("pm-recent") ?? []);
  }, []);

  // Onboarding: the welcome opens on the dashboard (never in the middle of a
  // task someone came to do), then the tour. /?tour=1 replays the tour.
  const router = useRouter();
  const [welcomed, setWelcomed] = useState(!welcome);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  // A new role while the app is open (say, just made a technician): welcome them again.
  useEffect(() => {
    if (welcome) setWelcomed(false);
  }, [welcome]);
  useEffect(() => {
    if (!welcomed && pathname === "/") setWelcomeOpen(true);
  }, [welcomed, pathname]);
  useEffect(() => {
    if (pathname === "/" && params.get("tour") === "1") {
      setTouring(true);
      router.replace("/", { scroll: false });
    }
  }, [pathname, params, router]);
  const done = () => {
    if (welcomed) return;
    setWelcomed(true);
    void finishWelcome();
  };

  // Close the phone menu after navigating, and on Esc.
  useEffect(() => setDrawer(false), [pathname, search]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  // Remember the record pages you open (once the page's heading is there).
  useEffect(() => {
    if (!staff || !RECORD.test(pathname)) return;
    let tries = 0;
    const timer = setInterval(() => {
      const title = pageTitle(false);
      if (!title && ++tries < 20) return;
      clearInterval(timer);
      if (!title) return;
      setRecent((list) => {
        const next = [{ href: pathname, title }, ...list.filter((l) => l.href !== pathname)].slice(0, 5);
        writeList("pm-recent", next);
        return next;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [pathname, staff]);

  const here = search ? `${pathname}?${search}` : pathname;
  const starred = favorites.some((f) => f.href === here);
  const toggleStar = () => {
    const next = starred ? favorites.filter((f) => f.href !== here) : [...favorites, { href: here, title: pageTitle(true) ?? here }].slice(-8);
    setFavorites(next);
    writeList("pm-favorites", next);
  };

  const sidebar = (onClose?: () => void) => (
    <Sidebar
      role={role}
      counts={counts}
      pathname={pathname}
      view={params.get("view")}
      favorites={favorites}
      recent={recent}
      user={user}
      signOutAction={signOutAction}
      onClose={onClose}
    />
  );

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:ring-2 focus:ring-accent-300">
        Skip to content
      </a>

      {sidebarOpen && (
        <aside className="sticky top-0 hidden h-screen w-[212px] shrink-0 border-r border-neutral-200/70 bg-white lg:block print:hidden">{sidebar()}</aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-1 border-b border-neutral-200/70 bg-white/95 px-3 backdrop-blur sm:gap-2 sm:px-6 lg:px-7 print:hidden">
          <button type="button" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer} className="btn-ghost lg:hidden" data-tour="menu">
            <Icon name="panelLeft" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              remember("pm-sidebar", !sidebarOpen);
            }}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            className="btn-ghost hidden lg:inline-flex"
          >
            <Icon name="panelLeft" />
          </button>
          {staff && (
            <button
              type="button"
              onClick={toggleStar}
              aria-pressed={starred}
              aria-label={starred ? "Remove this page from favorites" : "Add this page to favorites"}
              title={starred ? "Remove from favorites" : "Add to favorites"}
              className="btn-ghost hidden aria-pressed:bg-transparent sm:inline-flex"
            >
              <Icon name="star" filled={starred} className={`size-5 ${starred ? "text-amber-400" : ""}`} />
            </button>
          )}
          <Breadcrumb pathname={pathname} role={role} />

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {staff && <SearchBox />}
            {staff ? (
              <NewMenu admin={role === "ADMIN"} />
            ) : (
              <Link href="/requests/new" className="btn-primary h-8 px-3" data-tour="report">
                Report a problem
              </Link>
            )}
            <Link href="/help" aria-label="Help and guide" title="Help and guide" className="btn-ghost" data-tour="help">
              <Icon name="help" />
            </Link>
            <Bell count={counts.unread} />
            {rail && (
              <button
                type="button"
                onClick={() => {
                  setRailMode(railShown ? "closed" : "open");
                  remember("pm-rail", !railShown);
                }}
                aria-label={railShown ? "Hide activity panel" : "Show activity panel"}
                aria-expanded={railShown}
                title={railShown ? "Hide activity panel" : "Show activity panel"}
                className="btn-ghost hidden xl:inline-flex"
              >
                <Icon name="panelRight" />
              </button>
            )}
          </div>
        </header>

        {/* A size container: pages lay out by the room they actually get between the panels. */}
        <main id="main" className="@container flex-1 px-4 py-6 sm:px-6 lg:px-7">
          {children}
        </main>
      </div>

      {rail && railMode !== "closed" && (
        <aside
          aria-label="Notifications and activity"
          data-tour="activity"
          className={`sticky top-0 hidden h-screen w-[280px] shrink-0 overflow-y-auto border-l border-neutral-200/70 bg-white print:hidden ${railMode === "open" ? "xl:block" : RAIL_AUTO}`}
        >
          {rail}
        </aside>
      )}

      {welcomeOpen && (
        <Welcome
          role={role}
          user={user}
          onDone={(tour) => {
            setWelcomeOpen(false);
            if (tour) setTouring(true);
            else done();
          }}
        />
      )}
      {touring && (
        <Tour
          steps={tourSteps(role)}
          onClose={() => {
            setTouring(false);
            done();
          }}
        />
      )}

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-ink/30" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-white shadow-xl">{sidebar(() => setDrawer(false))}</aside>
        </div>
      )}
    </div>
  );
}

// ─── Breadcrumb ──────────────────────────────────────────────────────────────

function Breadcrumb({ pathname, role }: { pathname: string; role: Role }) {
  const items = crumbs(pathname, role);
  return (
    <nav aria-label="Breadcrumb" className="ml-1 min-w-0 text-sm">
      <ol className="flex items-center gap-2">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className={`min-w-0 items-center gap-2 ${last ? "flex" : "hidden sm:flex"}`}>
              {i > 0 && (
                <span className="hidden text-neutral-300 sm:inline" aria-hidden="true">
                  /
                </span>
              )}
              {last ? (
                <span aria-current="page" className="truncate text-ink">
                  {c.label}
                </span>
              ) : c.href ? (
                <Link href={c.href} className="whitespace-nowrap text-neutral-500 hover:text-ink">
                  {c.label}
                </Link>
              ) : (
                <span className="whitespace-nowrap text-neutral-500">{c.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── Top bar controls ────────────────────────────────────────────────────────

/** Search everything; ⌘K / Ctrl K jumps here from anywhere. */
function SearchBox() {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [mac, setMac] = useState(true);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        // The box is hidden on phones; go to the search page there.
        if (input.current?.offsetParent) input.current.focus();
        else router.push("/search");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);
  return (
    <>
      <form action="/search" role="search" className="relative hidden md:block" data-tour="search">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-neutral-400" />
        <input
          ref={input}
          name="q"
          type="search"
          placeholder="Search"
          aria-label="Search work orders, equipment, parts and requests"
          className="h-8 w-44 rounded-lg border border-transparent bg-neutral-100 pr-12 pl-8 text-sm text-ink placeholder:text-neutral-400 focus:border-accent-300 focus:bg-white focus:ring-2 focus:ring-accent-100 focus:outline-none lg:w-52 [&::-webkit-search-cancel-button]:hidden"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-sans text-xs text-neutral-400">{mac ? "⌘K" : "Ctrl K"}</kbd>
      </form>
      <Link href="/search" aria-label="Search" className="btn-ghost md:hidden" data-tour="search">
        <Icon name="search" />
      </Link>
    </>
  );
}

/** "+ New": the things staff create most, one click away from anywhere. */
function NewMenu({ admin }: { admin: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const items = [
    { href: "/work-orders/new", label: "Work order" },
    { href: "/requests/new", label: "Report a problem" },
    ...(admin
      ? [
          { href: "/assets/new", label: "Equipment (asset)" },
          { href: "/parts/new", label: "Part" },
        ]
      : []),
  ];
  return (
    <div ref={ref} className="relative" data-tour="new">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="New" className="btn-primary h-8 gap-1 px-2 sm:px-3">
        <Icon name="plus" className="size-4" />
        <span className="hidden sm:inline">New</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-1 w-52 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-neutral-200">
          {items.map((item) => (
            <Link key={item.href} role="menuitem" href={item.href} onClick={() => setOpen(false)} className="block px-3 py-2 text-sm text-ink hover:bg-neutral-50">
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Link to the notifications page, with the unread count. */
function Bell({ count }: { count: number }) {
  return (
    <Link href="/notifications" aria-label={count ? `Notifications, ${count} unread` : "Notifications"} title="Notifications" className="btn-ghost" data-tour="bell">
      <Icon name="bell" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-red-500 px-1 text-center text-[10px] leading-4 font-semibold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
