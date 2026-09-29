import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

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
    // Runs both when the link is requested and when it is used.
    signIn: ({ user }) => isAllowedEmail(user.email),
  },
});

/** For server components and actions: the signed-in user, or redirect to /login. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return session.user as { id: string; email: string; name?: string | null };
}
