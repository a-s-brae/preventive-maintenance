// Team password sign-in (lib/team-password.ts): while TEAM_PASSWORD is set,
// every page asks for a work email and the team password, using the browser's
// own sign-in box. Without TEAM_PASSWORD this does nothing and sign-in is by
// email link. Pages and actions still check who's signed in themselves (auth.ts).
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedEmail } from "@/lib/email-domains";
import { parseBasicAuth, passwordMatches, teamPassword } from "@/lib/team-password";

// Shown if the sign-in box is cancelled or the details are wrong.
const SIGN_IN_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · PM System</title></head>
<body style="font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem;color:#0f172a">
<h1 style="font-size:1.25rem">PM System</h1>
<p>Sign in with your <strong>work email</strong> as the username and the <strong>team password</strong>.</p>
<p style="color:#475569">Don't have the password? Ask your maintenance supervisor. To try again, reload this page.</p>
</body></html>`;

export function proxy(request: NextRequest) {
  const password = teamPassword();
  if (!password) return NextResponse.next();
  // Browsers send the saved password with requests other sites trigger too, so
  // changes (anything but reading) must come from this site's own pages.
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !fromThisSite(request)) {
    return new NextResponse("Refused: this change didn't come from the PM System's own pages.", { status: 403 });
  }
  const login = parseBasicAuth(request.headers.get("authorization"));
  if (login && passwordMatches(login.password, password) && isAllowedEmail(login.email)) return NextResponse.next();
  return new NextResponse(SIGN_IN_PAGE, {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="PM System", charset="UTF-8"', "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** Made by this site's own pages (or typed in), not by another website. */
function fromThisSite(request: NextRequest): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export const config = {
  // Everything but Next.js's own files and the daily email job, which Vercel
  // Cron signs with CRON_SECRET instead.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/cron/).*)"],
};
