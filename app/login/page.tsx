import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { currentUser, isAllowedEmail, localLogin, signIn, signInWithPassword, takeLocalLink, type PasswordSignIn } from "@/auth";
import { Icon, type IconName } from "@/components/icons";
import { LoginForm, PasswordForm, type LoginState } from "@/components/login-form";
import { db } from "@/lib/db";
import { emailConfigured } from "@/lib/mailer";
import { safeNext } from "@/lib/sign-in";
import { ORG_NAME } from "../print/print-parts";

const ERRORS: Record<string, string> = {
  AccessDenied: "That email address isn't allowed. Use your work email.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  Configuration: "Sign-in isn't set up correctly. Ask your administrator to check the email settings.",
  EmailSignInError: "We couldn't send the sign-in email. Try again, or contact your administrator.",
  Deactivated: "Your account has been deactivated. Ask an admin if you need access again.",
};
const GENERIC_ERROR = "Sign-in failed. Please try again.";

const PASSWORD_ERRORS: Record<Exclude<PasswordSignIn, { ok: true }>["error"], string> = {
  email: ERRORS.AccessDenied,
  password: "That email and password don't match. Forgot your password? Ask an admin to reset it.",
  deactivated: ERRORS.Deactivated,
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next: nextParam } = await searchParams;
  const next = safeNext(nextParam);
  if (await currentUser()) redirect(next);
  // The email-link way in, where there's email (or local mode, which skips it).
  const emailLink = localLogin || emailConfigured();

  async function passwordSignIn(_prev: LoginState, fd: FormData): Promise<LoginState> {
    "use server";
    const result = await signInWithPassword(String(fd.get("email") ?? ""), String(fd.get("password") ?? ""));
    if ("error" in result) return { error: PASSWORD_ERRORS[result.error] };
    redirect(safeNext(fd.get("next")));
  }

  async function requestSignIn(_prev: LoginState, fd: FormData): Promise<LoginState> {
    "use server";
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const redirectTo = safeNext(fd.get("next"));
    if (!isAllowedEmail(email)) return { error: ERRORS.AccessDenied };
    const existing = await db.user.findUnique({ where: { email }, select: { active: true } });
    if (existing && !existing.active) return { error: ERRORS.Deactivated };
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
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />
      <section className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <Mark className="mb-10 lg:hidden" />
          <h1 className="text-xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-neutral-600">Use your work email and your password.</p>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{ERRORS[error] ?? GENERIC_ERROR}</p>}
          <PasswordForm action={passwordSignIn} next={next} />
          {emailLink && (
            <div className="mt-8 border-t border-neutral-200/70 pt-6">
              <p className="mb-3 text-sm text-neutral-600">{localLogin ? "Or sign in without a password:" : "Or get a sign-in link by email:"}</p>
              {localLogin && (
                <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                  Local mode: no email check. Anyone who can open this page can sign in with any company address.
                </p>
              )}
              <LoginForm action={requestSignIn} localMode={localLogin} next={next} />
            </div>
          )}
          <div className="mt-8 space-y-2 border-t border-neutral-200/70 pt-6 text-sm text-neutral-600">
            <p>No password yet, or forgot it? Ask your maintenance supervisor (an admin) to set one for you.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

function Mark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-semibold text-ink ${className}`}>
      <span className="flex size-7 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white" aria-hidden="true">
        PM
      </span>
      PM System
    </div>
  );
}

const POINTS: [IconName, string, string][] = [
  ["repeat", "Planned maintenance on time", "PM schedules turn into work orders by themselves when they come due."],
  ["alert", "Problems reported in a minute", "Anyone can report one — or scan the QR code on a machine."],
  ["clipboard", "Every job on record", "Checklists, time, parts and photos, ready for audits and reports."],
];

/** What the system is, beside the form on wide screens. */
function BrandPanel() {
  return (
    <aside className="hidden flex-col justify-between bg-pastel-lavender p-10 lg:flex xl:p-14">
      <Mark />
      <div className="max-w-md">
        <h2 className="text-3xl leading-tight font-semibold text-ink">Maintenance that runs on time.</h2>
        <ul className="mt-8 space-y-5">
          {POINTS.map(([icon, title, text]) => (
            <li key={title} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-ink">
                <Icon name={icon} className="size-4" />
              </span>
              <div>
                <div className="text-sm font-medium text-ink">{title}</div>
                <p className="text-sm text-neutral-600">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-neutral-500">{ORG_NAME} · maintenance</p>
    </aside>
  );
}
