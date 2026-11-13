import { headers } from "next/headers";

/** This site's own address, for links in emails and on QR labels: APP_URL when
 *  set, else Vercel's production address. Only a run on your own computer falls
 *  back to the address the page was opened on (so phones on the same network can
 *  reach it); on Vercel, links never come from request headers. */
export async function appUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}
