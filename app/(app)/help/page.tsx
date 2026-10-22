import Link from "next/link";
import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { setGuideHidden } from "@/lib/actions";
import { showsGuide } from "@/lib/onboarding";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/permissions";
import { Icon } from "@/components/icons";
import { Card, PageHeader } from "@/components/ui";
import { Legend, REQUEST_STEPS, Steps, WORK_ORDER_STEPS, WorkFlow } from "@/components/work-flow";

export const dynamic = "force-dynamic";

type Section = { id: string; title: string; body: React.ReactNode };

const B = ({ children }: { children: React.ReactNode }) => <strong className="font-medium text-ink">{children}</strong>;

function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-neutral-400" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** The guide: how PM System works, for the role you have. */
export default async function HelpPage() {
  const user = await requireUser();
  const me = await db.user.findUnique({ where: { id: user.id }, select: { guideHiddenAs: true } });
  const guideHidden = !showsGuide({ role: user.role, guideHiddenAs: me?.guideHiddenAs ?? null });
  const sections = user.role === "REQUESTER" ? requesterSections() : staffSections(user.role === "ADMIN");

  return (
    <>
      <PageHeader title="Help & guide" description="How PM System works, and how to get things done.">
        {guideHidden && (
          <form action={setGuideHidden.bind(null, false)}>
            <button type="submit" className="btn-secondary">
              Show getting started
            </button>
          </form>
        )}
        <Link href="/?tour=1" className="btn-primary">
          <Icon name="play" className="size-4" />
          Take the tour
        </Link>
      </PageHeader>

      <div className="grid gap-6 @4xl:grid-cols-[13rem_minmax(0,1fr)]">
        <nav aria-label="On this page" className="self-start @4xl:sticky @4xl:top-20">
          <div className="mb-1 px-2 text-sm text-neutral-500">On this page</div>
          <ul className="space-y-0.5">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-neutral-100">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-6">
          {sections.map((s) => (
            <div key={s.id} id={s.id} className="scroll-mt-20">
              <Card title={s.title}>
                <div className="space-y-3 text-sm text-neutral-700">{s.body}</div>
              </Card>
            </div>
          ))}
          <p className="text-sm text-neutral-500">
            You&apos;re signed in as {ROLE_LABEL[user.role]} ({user.email}). Something missing or unclear? Tell your admin.
          </p>
        </div>
      </div>
    </>
  );
}

function requesterSections(): Section[] {
  return [
    {
      id: "report",
      title: "Reporting a problem",
      body: (
        <>
          <p>
            Press <B>Report a problem</B> (top right, or on your home page). Pick the machine, say what&apos;s wrong in a sentence or two, and how
            urgent it is. If the machine has stopped or can&apos;t be used, tick <B>The machine is down</B> — that gets attention fastest.
          </p>
          <Steps steps={REQUEST_STEPS} />
        </>
      ),
    },
    {
      id: "qr",
      title: "Reporting from your phone",
      body: (
        <p>
          Many machines have a QR label. Point your phone camera at it and open the link: the report form opens with the machine already filled in.
          (You may be asked to sign in the first time.)
        </p>
      ),
    },
    {
      id: "follow",
      title: "Following your requests",
      body: (
        <>
          <p>Your home page lists what you&apos;ve reported and where each one is at:</p>
          <Bullets
            items={[
              <>
                <B>Waiting for review</B> — maintenance hasn&apos;t looked at it yet.
              </>,
              <>
                <B>Approved</B> — it&apos;s now a work order (WO-…), and you can see when that&apos;s done.
              </>,
              <>
                <B>Rejected</B> — with the reason why (for example, it was already being fixed).
              </>,
            ]}
          />
          <p>The bell at the top tells you when anything changes.</p>
        </>
      ),
    },
    {
      id: "role",
      title: "On the maintenance team?",
      body: (
        <p>
          New people start as Requesters. If you do maintenance work, ask an admin to make you a <B>Technician</B> on the People page — you&apos;ll
          then see all the work and equipment, and get a short tour of it.
        </p>
      ),
    },
  ];
}

function staffSections(admin: boolean): Section[] {
  const sections: Section[] = [
    {
      id: "how-it-works",
      title: "How work flows",
      body: (
        <>
          <WorkFlow />
          <Bullets
            items={[
              <>
                <B>PM schedules</B> say what to do to a machine and how often. When one comes due, it makes a <B>work order</B> by itself.
              </>,
              <>
                <B>Requests</B> are problems anyone reports. An admin approves one into a work order (setting its priority, who does it and when), or
                rejects it with a reason.
              </>,
              <>
                You can also make a work order directly with <B>+ New</B>.
              </>,
              <>
                When a work order is completed, it goes into the machine&apos;s <B>history</B> and the <B>reports</B>, and a PM&apos;s next due date is
                worked out.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "roles",
      title: "Who can do what",
      body: (
        <>
          <dl className="divide-y divide-neutral-200/70">
            {(["ADMIN", "TECH", "REQUESTER"] as const).map((r) => (
              <div key={r} className="grid gap-1 py-2.5 @2xl:grid-cols-[8rem_1fr]">
                <dt className="font-medium text-ink">{ROLE_LABEL[r]}</dt>
                <dd>{ROLE_HELP[r]}</dd>
              </div>
            ))}
          </dl>
          <p>
            The first person to sign in becomes an admin; everyone after starts as a Requester. Admins change roles on <B>People</B>, and are told when
            someone new signs in.
          </p>
        </>
      ),
    },
    {
      id: "work-orders",
      title: "Doing a work order",
      body: (
        <>
          <Steps steps={WORK_ORDER_STEPS} />
          <Bullets
            items={[
              <>Checklist answers save the moment you enter them — if you&apos;re called away, nothing is lost. The first answer marks it In progress.</>,
              <>
                Number readings can have limits (say 90–125 psi); a reading outside them is flagged as you type. If anything fails, completing the work
                order offers a <B>follow-up repair</B> listing the problems.
              </>,
              <>
                Several people can be on the clock at once. Forgot the timer? Use <B>+ Log time manually</B>.
              </>,
              <>Parts you add come out of stock, and go back if you remove them.</>,
              <>
                Waiting on parts? <B>Put on hold</B>, then <B>Resume</B>.
              </>,
              <>
                If the machine was down, tick that it&apos;s running again when you complete. Need paper? <B>More → Print record</B>.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "due",
      title: "Due dates and PM schedules",
      body: (
        <>
          <Legend />
          <Bullets
            items={[
              <>
                A PM can repeat on the <B>calendar</B> (every N days, weeks, months or years), on <B>usage</B> (every N hours, cycles or miles — from
                meter readings), or <B>both</B>, whichever comes first.
              </>,
              <>
                After each completion, the next date is counted <B>from when it was done</B>, or kept on a <B>fixed calendar</B> (say, the 1st of every
                month) for compliance checks.
              </>,
              <>
                Its work order appears a few days before it&apos;s due (a week by default, less for short intervals), or in the last tenth of a usage
                interval. Need it sooner? <B>Start early</B> on PM schedules.
              </>,
              <>Record meter readings on the machine (or when completing work) so usage-based PMs know when they&apos;re due.</>,
            ]}
          />
        </>
      ),
    },
    {
      id: "requests",
      title: "Requests",
      body: (
        <>
          <Steps steps={REQUEST_STEPS} />
          <p>
            {admin
              ? "Review them under Requests: approve into a work order (pick the machine, priority, who does it and when) or reject with a reason. The person who reported it is told either way."
              : "Admins review them under Requests. You can report problems too, with + New → Report a problem."}
          </p>
        </>
      ),
    },
    {
      id: "equipment",
      title: "Equipment, downtime and QR labels",
      body: (
        <Bullets
          items={[
            <>
              Equipment sits in a <B>location</B> tree (plant → area → line), and a machine can have parts maintained separately under it (a dryer under
              its compressor).
            </>,
            <>
              When a machine stops, press <B>Mark down</B> on it (or tick &ldquo;machine is down&rdquo; on a request or repair); press{" "}
              <B>Mark back up</B> when it runs. Downtime adds up on the machine&apos;s Downtime tab and in the reports.
            </>,
            <>
              Keep manuals and nameplate photos on the machine&apos;s <B>Files</B> tab.
            </>,
            <>
              <B>QR labels</B> (Equipment → More → Print QR labels): staff scanning one go straight to the machine; anyone else gets the report form
              with it filled in.
            </>,
          ]}
        />
      ),
    },
    {
      id: "parts",
      title: "Parts and stock",
      body: (
        <p>
          The parts list shows what&apos;s on hand and where it&apos;s kept. Set a low-stock level and admins are told when it&apos;s reached. Use{" "}
          <B>Restock</B> when parts arrive and <B>Set count</B> after counting the shelf; every change is in the part&apos;s history.
        </p>
      ),
    },
    {
      id: "reports",
      title: "Reports",
      body: (
        <Bullets
          items={[
            <>
              <B>PM compliance</B>: PM work orders due in the range that were done by their due date. Open ones past due count as missed.
            </>,
            <>
              <B>MTTR</B> (mean time to repair): how long a breakdown lasts on average. <B>MTBF</B> (mean time between failures): running time per
              breakdown.
            </>,
            <>
              <B>Cost</B>: parts used, plus labor when you enter an hourly rate. Pick a date range; <B>More → Export</B> gives the numbers in Excel.
            </>,
          ]}
        />
      ),
    },
    {
      id: "notifications",
      title: "Notifications and daily email",
      body: (
        <p>
          The bell tells you when work is assigned to you or a PM comes due for you
          {admin ? ", and (for admins) about new requests, follow-up repairs, parts running low and new people" : ""}. Once email is set up,
          technicians and admins also get a short email each weekday morning listing what&apos;s overdue or due soon; admins turn it on or off for
          each person on the People page.
        </p>
      ),
    },
    {
      id: "finding",
      title: "Finding things fast",
      body: (
        <Bullets
          items={[
            <>
              <B>Search</B> (top bar, or <kbd className="rounded bg-neutral-100 px-1 text-xs">⌘K</kbd> /{" "}
              <kbd className="rounded bg-neutral-100 px-1 text-xs">Ctrl K</kbd>) finds work orders, machines, parts and requests — by name, tag,
              serial, part number, or a number like WO-0012.
            </>,
            <>
              <B>Favorites</B>: star any page (☆ in the top bar), filters included, to keep it at the top of the sidebar. <B>Recently</B> lists the
              records you opened.
            </>,
            <>Lists have quick filters (Overdue, Due this week, High priority…); exports, imports and printing are under each page&apos;s More menu.</>,
            <>The panel buttons in the top bar hide the sidebar or the activity panel when you want more room.</>,
          ]}
        />
      ),
    },
  ];
  if (admin) {
    sections.splice(1, 0, {
      id: "setup",
      title: "Setting up (admins)",
      body: (
        <>
          <ol className="space-y-2">
            {[
              ["Locations", "your plant, then its areas and lines.", "/locations"],
              ["Equipment", "add machines one by one, or import a list from Excel (Equipment → More → Import).", "/assets"],
              ["PM schedules", "on each machine's page: what to do, how often, and its checklist. Reuse checklists with templates.", "/pm"],
              ["Parts", "optional: the spares you keep, with low-stock levels.", "/parts"],
              ["People", "ask your team to sign in, then make maintenance staff Technicians.", "/people"],
              ["QR labels", "print and stick them on machines so anyone can report a problem.", "/print/labels"],
            ].map(([what, text, href], i) => (
              <li key={what} className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-medium text-white">{i + 1}</span>
                <span>
                  <Link href={href} className="font-medium text-ink hover:underline" {...(href.startsWith("/print") && { target: "_blank" })}>
                    {what}
                  </Link>{" "}
                  — {text}
                </span>
              </li>
            ))}
          </ol>
          <p>Your dashboard&apos;s setup checklist ticks these off as you go. On an empty system, the dashboard can also load sample equipment to try things out.</p>
        </>
      ),
    });
  }
  return sections;
}
