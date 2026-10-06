import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, isAllowedEmail, localLogin, signIn, takeLocalLink } from "@/auth";
import { LoginForm, type LoginState } from "@/components/login-form";
import { db } from "@/lib/db";

const ERRORS: Record<string, string> = {
  AccessDenied: "That email address isn't allowed. Use your company email.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  Configuration: "Sign-in isn't set up correctly. Ask your administrator to check the email settings.",
  EmailSignInError: "We couldn't send the sign-in email. Try again, or contact your administrator.",
};
const GENERIC_ERROR = "Sign-in failed. Please try again.";

/** Where to go after signing in: a path on this site only. */
const safeNext = (v: unknown) => (typeof v === "string" && /^\/(?![/\\])/.test(v) ? v : "/");

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next: nextParam } = await searchParams;
  const next = safeNext(nextParam);
  if ((await auth())?.user) redirect(next);

  async function requestSignIn(_prev: LoginState, fd: FormData): Promise<LoginState> {
    "use server";
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const redirectTo = safeNext(fd.get("next"));
    if (!isAllowedEmail(email)) return { error: ERRORS.AccessDenied };
    const existing = await db.user.findUnique({ where: { email }, select: { active: true } });
    if (existing && !existing.active) return { error: "Your account has been deactivated. Ask an admin if you need access again." };
    try {
      if (localLogin) {
        await signIn("resend", { email, redirect: false, redirectTo });
        const link = takeLocalLink(email);
        return link ? { link } : { error: GENERIC_ERROR };
      }
      // Sends the email, then redirects (by throwing) to "check your email".
      await signIn("resend", { email, redirectTo });
    } catch (e) {
      if (e instanceof AuthError) return { error: ERRORS[e.type] ?? GENERIC_ERROR };
      throw e;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">PM System</h1>
        <p className="mt-1 text-sm text-slate-600">
          {localLogin ? "Sign in with your company email." : "Sign in with your company email. We'll send you a link."}
        </p>
        {localLogin && (
          <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
            Local mode: no email check. Anyone who can open this page can sign in with any company address.
          </p>
        )}
        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {ERRORS[error] ?? GENERIC_ERROR}
          </p>
        )}
        <LoginForm action={requestSignIn} localMode={localLogin} next={next} />
      </div>
    </main>
  );
}
