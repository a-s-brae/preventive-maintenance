import Link from "next/link";
import type { RailData } from "@/lib/queries";
import { Avatar, displayName } from "./avatar";
import { Icon, type IconName } from "./icons";
import { TimeAgo } from "./time-ago";

const ROLE_LABEL = { ADMIN: "Admin", TECH: "Technician" } as const;

/** What a notification is about, from the page it opens. */
function iconFor(href: string): IconName {
  if (href.startsWith("/work-orders")) return "clipboard";
  if (href.startsWith("/requests")) return "inbox";
  if (href.startsWith("/parts")) return "box";
  if (href.startsWith("/assets")) return "cube";
  return "bell";
}

/** The right-hand panel: notifications, the team's latest activity, and the team. */
export function RightRail({ data, canManagePeople }: { data: RailData; canManagePeople: boolean }) {
  return (
    <div className="space-y-6 px-5 py-5">
      <section aria-labelledby="rail-notifications">
        <RailHeading id="rail-notifications" href="/notifications" more="See all">
          Notifications
        </RailHeading>
        {data.notifications.length === 0 ? (
          <p className="text-xs text-neutral-500">Nothing new.</p>
        ) : (
          <ul className="space-y-1">
            {data.notifications.map((n) => (
              <li key={n.id}>
                {/* A plain link: the route marks it read, then redirects. */}
                <a href={`/notifications/${n.id}`} className="-mx-2 flex gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-pastel-blue text-ink">
                    <Icon name={iconFor(n.href)} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm text-ink ${n.read ? "" : "font-medium"}`} title={n.title}>
                      {n.title}
                    </span>
                    <TimeAgo iso={n.at} className="block text-xs text-neutral-500" />
                  </span>
                  {!n.read && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent-500">
                      <span className="sr-only">Unread</span>
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="rail-activity">
        <RailHeading id="rail-activity">Activity</RailHeading>
        {data.activity.length === 0 ? (
          <p className="text-xs text-neutral-500">No activity in the last 30 days.</p>
        ) : (
          <ol>
            {data.activity.map((a, i) => {
              const who = a.who ? displayName(a.who) : "Someone";
              return (
                <li key={a.id} className="relative pb-3 last:pb-0">
                  {/* The thread joining one avatar to the next. */}
                  {i < data.activity.length - 1 && <span className="absolute top-8 bottom-1 left-3 w-px bg-neutral-200" aria-hidden="true" />}
                  <Link href={a.href} className="-mx-2 flex gap-2 rounded-lg px-2 py-1 hover:bg-neutral-50">
                    <Avatar name={who} seed={a.who?.id ?? "?"} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm text-ink">
                        <span className="font-medium">{who}</span> {a.text.charAt(0).toLowerCase() + a.text.slice(1)}
                      </span>
                      <TimeAgo iso={a.at} className="block text-xs text-neutral-500" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section aria-labelledby="rail-team">
        <RailHeading id="rail-team" href={canManagePeople ? "/people" : undefined} more="Manage">
          Team
        </RailHeading>
        <ul className="space-y-1">
          {data.team.map((u) => {
            const name = displayName(u);
            return (
              <li key={u.id}>
                <a href={`mailto:${u.email}`} className="-mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50" title={`Email ${u.email}`}>
                  <Avatar name={name} seed={u.id} />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{name}</span>
                  <span className="text-xs text-neutral-500">{ROLE_LABEL[u.role]}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function RailHeading({ id, href, more, children }: { id: string; href?: string; more?: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 id={id} className="text-sm text-ink">
        {children}
      </h2>
      {href && more && (
        <Link href={href} className="text-xs text-neutral-500 hover:text-ink">
          {more}
        </Link>
      )}
    </div>
  );
}
