import { requireUser } from "@/auth";
import { db } from "@/lib/db";
import { changeMyPassword } from "@/lib/actions";
import { ChangePasswordForm } from "@/components/password-forms";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Your own account: change your password. */
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ changed?: string }> }) {
  const user = await requireUser();
  const { changed } = await searchParams;
  const hasPassword = (await db.password.count({ where: { userId: user.id } })) > 0;
  return (
    <>
      <PageHeader title="Account" />
      <p className="-mt-3 mb-6 text-sm text-neutral-600">Signed in as {user.email}.</p>
      {changed && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">Password saved.</p>
      )}
      <Card title={hasPassword ? "Change your password" : "Set your password"}>
        {!hasPassword && (
          <p className="mb-4 text-sm text-amber-800">You don&apos;t have your own password yet. Set one now: the shared team password is going away.</p>
        )}
        <ChangePasswordForm action={changeMyPassword} hasPassword={hasPassword} />
      </Card>
    </>
  );
}
