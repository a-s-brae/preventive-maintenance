import { redirect } from "next/navigation";
import { currentUser, requireUser } from "@/auth";
import { can } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** Where an equipment QR label points. Staff land on the asset; everyone else
 *  on "Report a problem" with the asset filled in. */
export default async function ScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await currentUser())) redirect(`/login?next=${encodeURIComponent(`/a/${id}`)}`);
  const user = await requireUser();
  redirect(can(user.role, "view") ? `/assets/${encodeURIComponent(id)}` : `/requests/new?assetId=${encodeURIComponent(id)}`);
}
