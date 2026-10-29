// Passes the page someone asked for on to auth.ts, so signing in brings them
// back to it (a QR label, a link in the daily email). Pages, actions and routes
// check who's signed in themselves (auth.ts).
import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  // Always set here, so a browser can't supply its own.
  headers.set("x-pm-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only: not Next.js's own files or the API routes.
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/).*)"],
};
