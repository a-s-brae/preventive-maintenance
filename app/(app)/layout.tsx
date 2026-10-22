import { cookies } from "next/headers";
import { requireUser, signOut } from "@/auth";
import { can } from "@/lib/permissions";
import { getNavCounts, getRailData } from "@/lib/queries";
import { teamPassword } from "@/lib/team-password";
import { AppShell } from "@/components/app-shell";
import { displayName } from "@/components/avatar";
import { RightRail } from "@/components/right-rail";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const staff = can(user.role, "view");
  const [counts, rail, jar] = await Promise.all([getNavCounts(user.id, staff), staff ? getRailData(user.id) : null, cookies()]);
  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  return (
    <AppShell
      user={{ id: user.id, name: displayName(user), email: user.email }}
      role={user.role}
      counts={counts}
      // With a team password the browser holds the sign-in, so there's no signing out.
      signOutAction={teamPassword() ? undefined : signOutAction}
      rail={rail && <RightRail data={rail} canManagePeople={can(user.role, "people")} />}
      initialSidebar={jar.get("pm-sidebar")?.value !== "closed"}
      initialRail={(["open", "closed"] as const).find((v) => v === jar.get("pm-rail")?.value) ?? "auto"}
    >
      {children}
    </AppShell>
  );
}
