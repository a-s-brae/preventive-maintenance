import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";

/** Open a notification: mark it read and go to its page. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const n = await db.notification.findFirst({ where: { id, userId: me.id } });
  if (!n) redirect("/notifications");
  if (!n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  // Only ever a path on this site.
  redirect(n.href.startsWith("/") && !n.href.startsWith("//") ? n.href : "/notifications");
}
