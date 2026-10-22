import { requireUser } from "@/auth";
import Link from "next/link";
import { db } from "@/lib/db";
import { markAllNotificationsRead } from "@/lib/actions";
import { formatDateTime } from "@/lib/downtime";
import { KEEP_READ_DAYS } from "@/lib/notify";
import { can } from "@/lib/permissions";
import { getAllOpenWorkOrders } from "@/lib/queries";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const me = await requireUser();
  // Tidy up: read notices older than KEEP_READ_DAYS go.
  await db.notification.deleteMany({ where: { userId: me.id, readAt: { lt: new Date(Date.now() - KEEP_READ_DAYS * 86_400_000) } } });
  const [items, overdueMine] = await Promise.all([
    db.notification.findMany({ where: { userId: me.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    can(me.role, "view") ? getAllOpenWorkOrders().then((wos) => wos.filter((w) => w.assignedToId === me.id && w.due.status === "OVERDUE").length) : 0,
  ]);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader title="Notifications">
        {unread > 0 && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="btn-secondary">
              Mark all read
            </button>
          </form>
        )}
      </PageHeader>
      {overdueMine > 0 && (
        <Link
          href="/work-orders?view=mine&due=overdue"
          className="mb-4 block rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800 ring-1 ring-red-200 hover:bg-red-100"
        >
          {overdueMine} of your work orders {overdueMine === 1 ? "is" : "are"} overdue →
        </Link>
      )}
      <Card>
        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">
            Nothing yet. You’ll see work assigned to you, updates on your requests{can(me.role, "review") ? ", new requests and low stock" : ""} here.
          </p>
        ) : (
          <ul className="-my-2 divide-y divide-neutral-100">
            {items.map((n) => (
              <li key={n.id}>
                <a href={`/notifications/${n.id}`} className="-mx-2 flex gap-3 rounded-lg px-2 py-3 hover:bg-neutral-50">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-accent-600"}`}
                    aria-label={n.readAt ? undefined : "Unread"}
                  />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.readAt ? "text-neutral-700" : "font-semibold text-neutral-900"}`}>{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-sm text-neutral-600">{n.body}</span>}
                    <span className="mt-0.5 block text-xs text-neutral-500">{formatDateTime(n.createdAt)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
