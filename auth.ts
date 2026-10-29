import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { isAllowedEmail } from "@/lib/email-domains";
import { notifyNewPerson } from "@/lib/notify";
import { can, type Permission } from "@/lib/permissions";
import { loginHref } from "@/lib/sign-in";
import { passwordMatches, teamPassword } from "@/lib/team-password";

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

// Sign-in cookies are Secure over https (Vercel); a run on this computer is
// plain http. Said outright, so team password sign-in (below) uses the cookie
// Auth.js looks for.
const secureCookies = !!process.env.VERCEL || (process.env.AUTH_URL ?? "").startsWith("https://");
const SESSION_COOKIE = `${secureCookies ? "__Secure-" : ""}authjs.session-token`;
const SESSION_DAYS = 30;

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "database", maxAge: SESSION_DAYS * 86_400 },
  useSecureCookies: secureCookies,
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

export type TeamSignIn = { ok: true } | { error: "off" | "email" | "password" | "deactivated" };

/** Team password sign-in (lib/team-password.ts), from the sign-in page: check
 *  the password, find or make the person's account, and start their session —
 *  the same kind an email link starts, so signing out works the same. The very
 *  first person becomes the admin, as with email sign-in; after that, admins
 *  are told someone new is here. */
export async function signInWithTeamPassword(rawEmail: string, password: string): Promise<TeamSignIn> {
  const expected = teamPassword();
  if (!expected) return { error: "off" };
  const email = rawEmail.trim().toLowerCase();
  if (!isAllowedEmail(email)) return { error: "email" };
  if (!passwordMatches(password, expected)) {
    // A pause makes guessing slow.
    await new Promise((r) => setTimeout(r, 750));
    return { error: "password" };
  }
  const user = await findOrCreateUser(email);
  if (!user.active) return { error: "deactivated" };
  const sessionToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { sessionToken, userId: user.id, expires } });
  (await cookies()).set(SESSION_COOKIE, sessionToken, { httpOnly: true, sameSite: "lax", path: "/", secure: secureCookies, expires });
  return { ok: true };
}

async function findOrCreateUser(email: string) {
  const select = { id: true, active: true } as const;
  const existing = await db.user.findUnique({ where: { email }, select });
  if (existing) return existing;
  try {
    const first = (await db.user.count()) === 0;
    const created = await db.user.create({ data: { email, role: first ? "ADMIN" : "REQUESTER" }, select });
    if (!first) await notifyNewPerson(db, email);
    return created;
  } catch (e) {
    // Signed in twice at once: the other one made it.
    const created = await db.user.findUnique({ where: { email }, select });
    if (created) return created;
    throw e;
  }
}

/** The signed-in person, or null. Route handlers use this; pages and actions use requireUser. */
export async function currentUser(): Promise<CurrentUser | null> {
  const user = (await auth())?.user as CurrentUser | undefined;
  return user?.id ? user : null;
}

/** For server components and actions: the signed-in user, or off to sign in
 *  (and back to this page afterwards; proxy.ts says which page it was). */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(loginHref((await headers()).get("x-pm-path")));
  if (user.active === false) {
    // Deactivated: end their sessions (a page can't clear the cookie itself) and say why.
    await db.session.deleteMany({ where: { userId: user.id } });
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
