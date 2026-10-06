import { requirePermission } from "@/auth";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteLocation, saveLocation } from "@/lib/actions";
import { getLocationTree } from "@/lib/queries";
import { descendantIds } from "@/lib/tree";
import { DeleteLocationForm, LocationForm } from "@/components/location-form";
import { Card, PageHeader } from "@/components/ui";

export default async function EditLocationPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("manage");
  const { id } = await params;
  const [location, tree] = await Promise.all([db.location.findUnique({ where: { id } }), getLocationTree()]);
  if (!location) notFound();
  const own = descendantIds(tree, id);
  return (
    <>
      <PageHeader title={`Edit ${location.name}`}>
        <DeleteLocationForm action={deleteLocation.bind(null, id)} />
      </PageHeader>
      <Card>
        <LocationForm action={saveLocation.bind(null, id)} location={location} parents={tree.filter((l) => !own.has(l.id))} />
      </Card>
    </>
  );
}
