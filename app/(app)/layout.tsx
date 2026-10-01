import { requireUser, signOut } from "@/auth";
import { getNavCounts } from "@/lib/queries";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const counts = await getNavCounts(user.id);
  return (
    <AppShell
      email={user.email}
      counts={counts}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      {children}
    </AppShell>
  );
}
