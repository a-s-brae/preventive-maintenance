import Link from "next/link";
import { requireUser, signOut } from "@/auth";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/work-orders", label: "Work orders" },
  { href: "/work-orders/calendar", label: "Calendar" },
  { href: "/pm", label: "PM schedules" },
  { href: "/assets", label: "Assets" },
  { href: "/history", label: "History" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 px-4 pt-3 lg:py-3">
          <Link href="/" className="font-semibold">
            PM System
          </Link>
          {/* Its own scrollable row below the brand on small screens; inline on large ones. */}
          <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-5 overflow-x-auto px-4 py-2.5 text-sm whitespace-nowrap lg:order-none lg:mx-0 lg:w-auto lg:overflow-visible lg:p-0">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-slate-600 hover:text-slate-900">
                {n.label}
              </Link>
            ))}
          </nav>
          <form
            className="ml-auto flex items-center gap-3 text-sm text-slate-500"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <span className="hidden sm:inline">{user.email}</span>
            <button type="submit" className="link">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
