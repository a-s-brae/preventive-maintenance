import { saveLocation } from "@/lib/actions";
import { getLocationTree } from "@/lib/queries";
import { LocationForm } from "@/components/location-form";
import { Card, PageHeader } from "@/components/ui";

export default async function NewLocationPage({ searchParams }: { searchParams: Promise<{ parentId?: string }> }) {
  const [{ parentId }, locations] = await Promise.all([searchParams, getLocationTree()]);
  return (
    <>
      <PageHeader title="New location" />
      <Card>
        <LocationForm action={saveLocation.bind(null, null)} parents={locations} defaultParentId={parentId} />
      </Card>
    </>
  );
}
