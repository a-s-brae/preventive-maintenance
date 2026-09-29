import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, isAllowedEmail, signIn } from "@/auth";

const ERRORS: Record<string, string> = {
  AccessDenied: "That email address isn't allowed. Use your company email.",
  Verification: "That sign-in link has expired or was already used. Request a new one.",
  Configuration: "Sign-in isn't set up correctly. Ask your administrator to check the email settings.",
  EmailSignInError: "We couldn't send the sign-in email. Try again, or contact your administrator.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if ((await auth())?.user) redirect("/");
  const { error } = await searchParams;

  async function sendLink(fd: FormData) {
    "use server";
    const email = String(fd.get("email") ?? "").trim();
    if (!isAllowedEmail(email)) redirect("/login?error=AccessDenied");
    try {
      await signIn("resend", { email, redirectTo: "/" });
    } catch (e) {
      // signIn() redirects by throwing; only turn real auth failures into a message.
      if (e instanceof AuthError) redirect(`/login?error=${e.type}`);
      throw e;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">PM System</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in with your company email. We&apos;ll send you a link.</p>
        {error && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
            {ERRORS[error] ?? "Sign-in failed. Please try again."}
          </p>
        )}
        <form action={sendLink} className="mt-4 space-y-3">
          <input name="email" type="email" required autoComplete="email" placeholder="you@as-plastech.com" className="input" />
          <button type="submit" className="btn-primary w-full">
            Email me a sign-in link
          </button>
        </form>
      </div>
    </main>
  );
}
