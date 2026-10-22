import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { isAllowedEmail } from "@/lib/email-domains";
import { notifyNewPerson } from "@/lib/notify";
import { can, type Permission } from "@/lib/permissions";
import { parseBasicAuth, passwordMatches, teamPassword } from "@/lib/team-password";

export { isAllowedEmail };

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
    // The very first person to sign in to a new system becomes its admin;
    // after that, admins are told someone new is here.
    createUser: async ({ user }) => {
      if (!user.id) return;
      if ((await db.user.count()) === 1) await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
      else if (user.email) await notifyNewPerson(db, user.email);
    },
  },
});

export type SessionUser = { id: string; email: string; name?: string | null; role: Role };
type CurrentUser = SessionUser & { active?: boolean };

/** Team password sign-in (lib/team-password.ts): the person is the work email
 *  given with the team password. Their account is made the first time they
 *  sign in; the very first person becomes the admin, as with email sign-in. */
const teamPasswordUser = cache(async (): Promise<CurrentUser | null> => {
  const password = teamPassword();
  const login = parseBasicAuth((await headers()).get("authorization"));
  if (!password || !login || !passwordMatches(login.password, password) || !isAllowedEmail(login.email)) return null;
  const select = { id: true, email: true, name: true, role: true, active: true } as const;
  const existing = await db.user.findUnique({ where: { email: login.email }, select });
  if (existing) return existing;
  try {
    const first = (await db.user.count()) === 0;
    const created = await db.user.create({ data: { email: login.email, role: first ? "ADMIN" : "REQUESTER" }, select });
    if (!first) await notifyNewPerson(db, login.email);
    return created;
  } catch (e) {
    // Another request from the same browser made it first.
    const created = await db.user.findUnique({ where: { email: login.email }, select });
    if (created) return created;
    throw e;
  }
});

/** The signed-in person, or null. Route handlers use this; pages and actions use requireUser. */
export async function currentUser(): Promise<CurrentUser | null> {
  if (teamPassword()) return teamPasswordUser();
  const user = (await auth())?.user as CurrentUser | undefined;
  return user?.id ? user : null;
}

/** For server components and actions: the signed-in user, or redirect to /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  // With a team password the browser has already been asked (proxy.ts); /login explains.
  if (!user) redirect(teamPassword() ? "/login?error=TeamPassword" : "/login");
  if (user.active === false) {
    if (!teamPassword()) await signOut({ redirect: false });
    redirect("/login?error=Deactivated");
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
