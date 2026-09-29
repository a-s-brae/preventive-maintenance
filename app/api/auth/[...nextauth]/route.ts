import { NextRequest } from "next/server";
import { handlers } from "@/auth";

type Handler = (req: NextRequest) => Promise<Response>;

// Off Vercel, Next.js hands route handlers a "localhost" URL even when the app
// was opened by another address (e.g. a coworker using this computer's network
// IP), so Auth.js would redirect them to localhost after sign-in. Rebuild the
// URL from the host the browser actually used.
function withRequestHost(handler: Handler): Handler {
  if (process.env.VERCEL || process.env.AUTH_URL) return handler;
  return async (req) => {
    const host = req.headers.get("x-forwarded-host");
    if (!host) return handler(req);
    const url = new URL(req.url);
    url.host = host;
    url.protocol = `${req.headers.get("x-forwarded-proto") ?? "http"}:`;
    const body = req.method === "POST" ? await req.text() : undefined;
    return handler(new NextRequest(url, { method: req.method, headers: req.headers, body }));
  };
}

export const GET = withRequestHost(handlers.GET);
export const POST = withRequestHost(handlers.POST);
