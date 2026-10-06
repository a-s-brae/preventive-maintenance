import { notFound } from "next/navigation";
import { requirePermission } from "@/auth";
import { db } from "@/lib/db";
import { savePart } from "@/lib/actions";
import { PartForm } from "@/components/part-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function EditPartPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("manage");
  const { id } = await params;
  const part = await db.part.findUnique({ where: { id } });
  if (!part) notFound();
  return (
    <>
      <PageHeader title={`Edit ${part.name}`} />
      <Card>
        <PartForm action={savePart.bind(null, part.id)} part={part} />
      </Card>
    </>
  );
}
