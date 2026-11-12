import Link from "next/link";
import type { Role } from "@prisma/client";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { addPerson, sendDigestNow, setPersonPassword, updatePerson } from "@/lib/actions";
import { emailConfigured } from "@/lib/mailer";
import { ROLE_HELP, ROLE_LABEL } from "@/lib/permissions";
import { AddPersonForm, SetPasswordForm } from "@/components/password-forms";
import { PersonRow } from "@/components/person-row";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; skipped?: string; error?: string; added?: string; passwordSet?: string }>;
}) {
  const me = await requirePermission("people");
  const sp = await searchParams;
  const [people, passwords] = await Promise.all([
    db.user.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { email: "asc" }] }),
    db.password.findMany({ select: { userId: true } }),
  ]);
  const hasPassword = new Set(passwords.map((p) => p.userId));
  return (
    <>
      <PageHeader title="People" />
      <p className="-mt-3 mb-6 max-w-3xl text-sm text-neutral-600">
        Everyone who can sign in appears here, each with their own password. New people start as <strong>Requesters</strong> —
        make maintenance staff Technicians, and supervisors Admins.
      </p>
      {(sp.added || sp.passwordSet) && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
          {sp.added ? "Added. Give them their starting password; they can change it on their Account page." : "Password saved. They've been signed out everywhere else."}
        </p>
      )}
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
            <div key={p.id}>
              <PersonRow
                action={updatePerson.bind(null, p.id)}
                person={p}
                isMe={p.id === me.id}
                isNew={p.active && p.role === "REQUESTER" && p.createdAt.getTime() > Date.now() - 14 * 86_400_000}
              />
              <SetPasswordForm action={setPersonPassword.bind(null, p.id)} email={p.email} hasPassword={hasPassword.has(p.id)} />
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-6">
        <Card title="Add a person">
          <AddPersonForm action={addPerson} />
        </Card>
      </div>

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
