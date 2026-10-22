import Link from "next/link";
import type { Role } from "@prisma/client";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { sendDigestNow, updatePerson } from "@/lib/actions";
import { emailConfigured } from "@/lib/mailer";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/permissions";
import { PersonRow } from "@/components/person-row";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PeoplePage({ searchParams }: { searchParams: Promise<{ sent?: string; skipped?: string; error?: string }> }) {
  const me = await requirePermission("people");
  const sp = await searchParams;
  const people = await db.user.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { email: "asc" }] });
  return (
    <>
      <PageHeader title="People" />
      <p className="-mt-3 mb-6 max-w-3xl text-sm text-neutral-600">
        Everyone who has signed in appears here. New people start as <strong>Requesters</strong> — make maintenance staff
        Technicians, and supervisors Admins.
      </p>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
          <div key={r} className="rounded-2xl bg-surface p-4 text-sm">
            <div className="font-medium">
              {ROLE_LABEL[r]} <span className="text-neutral-500">· {people.filter((p) => p.role === r && p.active).length}</span>
            </div>
            <div className="mt-1 text-xs text-neutral-600">{ROLE_HELP[r]}</div>
          </div>
        ))}
      </div>
      <Card>
        <div className="divide-y divide-neutral-100">
          {people.map((p) => (
            <PersonRow key={p.id} action={updatePerson.bind(null, p.id)} person={p} isMe={p.id === me.id} />
          ))}
        </div>
      </Card>

      <div className="mt-6">
        <Card title="Daily email">
          <div className="space-y-3 text-sm">
            <p className="text-neutral-600">
              Each weekday morning, technicians and admins with <em>Daily email</em> on get their overdue and due-soon work orders;
              admins also get a summary (overdue, equipment down, requests waiting, low stock). Nobody gets an email when there&apos;s
              nothing to report.
            </p>
            {emailConfigured() ? (
              <p className="text-emerald-800">✓ Email is set up.</p>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900 ring-1 ring-amber-200">
                Email isn&apos;t set up on this computer, so nothing is sent. It works once the system is hosted with an email
                service (see the README). You can still preview what people would get.
              </p>
            )}
            {sp.sent !== undefined && (
              <p className={sp.error ? "text-red-700" : "text-emerald-800"}>
                Sent {sp.sent}, nothing to report for {sp.skipped}.{sp.error ? ` Problem: ${sp.error}` : ""}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href="/people/digest" className="btn-secondary">
                Preview emails
              </Link>
              {emailConfigured() && (
                <form action={sendDigestNow}>
                  <button type="submit" className="btn-secondary">
                    Send now
                  </button>
                </form>
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
