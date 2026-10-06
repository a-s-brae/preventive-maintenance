import { sendDigests } from "@/lib/digest";

/** Daily email, called by Vercel Cron (see vercel.json). Vercel sends
 *  "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Not allowed", { status: 401 });
  const base = process.env.APP_URL ?? new URL(req.url).origin;
  return Response.json(await sendDigests(base));
}
