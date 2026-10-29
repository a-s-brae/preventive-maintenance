import { cookies } from "next/headers";
import { requireUser, signOut } from "@/auth";
import { can } from "@/lib/permissions";
import { db } from "@/lib/db";
import { needsWelcome } from "@/lib/onboarding";
import { getNavCounts, getRailData } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";
import { displayName } from "@/components/avatar";
import { RightRail } from "@/components/right-rail";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const staff = can(user.role, "view");
  const [counts, rail, jar, me] = await Promise.all([
    getNavCounts(user.id, staff),
    staff ? getRailData(user.id) : null,
    cookies(),
    db.user.findUnique({ where: { id: user.id }, select: { welcomedAs: true } }),
  ]);
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <AppShell
      user={{ id: user.id, name: displayName(user), email: user.email }}
      role={user.role}
      counts={counts}
      signOutAction={signOutAction}
      rail={rail && <RightRail data={rail} canManagePeople={can(user.role, "people")} />}
      initialSidebar={jar.get("pm-sidebar")?.value !== "closed"}
      initialRail={(["open", "closed"] as const).find((v) => v === jar.get("pm-rail")?.value) ?? "auto"}
      welcome={needsWelcome({ role: user.role, welcomedAs: me?.welcomedAs ?? null })}
    >
      {children}
    </AppShell>
  );
}
