import { timingSafeEqual } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import { sendDigests } from "@/lib/digest";

/** Daily email, called by Vercel Cron (see vercel.json). Vercel sends
 *  "Authorization: Bearer $CRON_SECRET" when CRON_SECRET is set. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Not allowed", { status: 401 });
  return Response.json(await sendDigests(await appUrl()));
}
