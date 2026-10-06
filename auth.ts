import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { can, type Permission } from "@/lib/permissions";

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS ?? "as-plastech.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAllowedEmail(email: string | null | undefined): boolean {
  const domain = email?.toLowerCase().split("@")[1];
  return !!domain && allowedDomains.includes(domain);
}

/** Local mode, for running on your own computer: sign-in skips the email step,
 *  so anyone who can open the app can sign in with any allowed address. It is
 *  never enabled on Vercel. */
export const localLogin = process.env.AUTH_LOCAL_LOGIN === "true" && !process.env.VERCEL;

// In local mode the sign-in "email" is never sent: the link is kept here and
// handed straight back to the login page, which opens it.
const localLinks = new Map<string, string>();

/** The sign-in link just generated for this email (local mode only). */
export function takeLocalLink(email: string): string | undefined {
  const key = email.trim().toLowerCase();
  const link = localLinks.get(key);
  localLinks.delete(key);
  return link;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  providers: [
    Resend({
      from: process.env.EMAIL_FROM ?? "PM System <onboarding@resend.dev>",
      ...(localLogin ? { sendVerificationRequest: async ({ identifier, url }) => void localLinks.set(identifier, url) } : {}),
    }),
  ],
  pages: { signIn: "/login", verifyRequest: "/login/check-email", error: "/login" },
  callbacks: {
    // Runs both when the link is requested and when it is used. Deactivated
    // people can't sign in.
    signIn: ({ user }) => isAllowedEmail(user.email) && (user as { active?: boolean }).active !== false,
    session: ({ session, user }) => {
      const u = user as unknown as { id: string; role: Role; active: boolean };
      return { ...session, user: { ...session.user, id: u.id, role: u.role, active: u.active } };
    },
  },
  events: {
    // The very first person to sign in to a new system becomes its admin.
    createUser: async ({ user }) => {
      if (user.id && (await db.user.count()) === 1) await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    },
  },
});

export type SessionUser = { id: string; email: string; name?: string | null; role: Role };

/** For server components and actions: the signed-in user, or redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user as (SessionUser & { active?: boolean }) | undefined;
  if (!user?.id) redirect("/login");
  if (user.active === false) {
    await signOut({ redirect: false });
    redirect("/login?error=AccessDenied");
  }
  return user;
}

/** The signed-in user, who must have this permission. Pages send anyone else
 *  home; actions called without it are refused the same way. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/?denied=1");
  return user;
}
