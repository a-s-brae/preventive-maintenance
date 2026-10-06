// In-app notifications (the bell). Each one is a short line and the page it
// opens. They're created alongside the change they describe — in the same
// transaction where there is one — and nobody is notified of their own action.
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export interface Notice {
  title: string;
  body?: string | null;
  href: string;
}

/** Notify these people (blanks and duplicates ignored), except `actorId`. */
export async function notify(db: Db, userIds: (string | null | undefined)[], notice: Notice, actorId?: string | null): Promise<number> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id && id !== actorId))];
  if (ids.length === 0) return 0;
  const { count } = await db.notification.createMany({
    data: ids.map((userId) => ({ userId, title: notice.title.slice(0, 300), body: notice.body?.slice(0, 1000) ?? null, href: notice.href })),
  });
  return count;
}

/** Active admins: they review requests and look after the parts list. */
export async function adminIds(db: Db): Promise<string[]> {
  return (await db.user.findMany({ where: { role: "ADMIN", active: true }, select: { id: true } })).map((u) => u.id);
}

/** Read notifications older than this are cleared out. */
export const KEEP_READ_DAYS = 60;
