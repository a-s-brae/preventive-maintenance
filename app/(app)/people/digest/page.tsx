import { requirePermission } from "@/auth";
import { appUrl } from "@/lib/app-url";
import { buildDigest, gatherDigests } from "@/lib/digest";
import { Card, Empty, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/** What each person's daily email would say right now. */
export default async function DigestPreviewPage() {
  await requirePermission("people");
  const digests = (await gatherDigests(await appUrl())).map((d) => ({ ...d, msg: buildDigest(d.input) }));
  return (
    <>
      <PageHeader title="Daily email preview" />
      {digests.length === 0 && <Empty>Nobody has daily email turned on (only technicians and admins can get it).</Empty>}
      <div className="space-y-6">
        {digests.map((d) => (
          <Card key={d.email} title={`${d.email} — ${d.msg ? d.msg.subject : "nothing to send"}`}>
            {d.msg ? (
              // The digest HTML is built from escaped values in lib/digest.ts.
              <div className="prose prose-sm max-w-none text-sm [&_a]:text-accent-700 [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2" dangerouslySetInnerHTML={{ __html: d.msg.html }} />
            ) : (
              <p className="text-sm text-neutral-500">Nothing overdue or due soon — no email today.</p>
            )}
          </Card>
        ))}
      </div>
    </>
  );
}
