import { requirePermission } from "@/auth";
import { savePart } from "@/lib/actions";
import { PartForm } from "@/components/part-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function NewPartPage() {
  await requirePermission("manage");
  return (
    <>
      <PageHeader title="New part" />
      <Card>
        <PartForm action={savePart.bind(null, null)} />
      </Card>
    </>
  );
}
