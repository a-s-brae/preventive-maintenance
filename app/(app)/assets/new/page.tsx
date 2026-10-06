import { requirePermission } from "@/auth";
import { saveAsset } from "@/lib/actions";
import { getAssetTree, getLocationTree } from "@/lib/queries";
import { AssetForm } from "@/components/asset-form";
import { Card, PageHeader } from "@/components/ui";

export default async function NewAssetPage({ searchParams }: { searchParams: Promise<{ locationId?: string; parentId?: string }> }) {
  await requirePermission("manage");
  const [defaults, locations, parents] = await Promise.all([searchParams, getLocationTree(), getAssetTree()]);
  return (
    <>
      <PageHeader title="New asset" />
      <Card>
        <AssetForm action={saveAsset.bind(null, null)} locations={locations} parents={parents} defaults={defaults} />
      </Card>
    </>
  );
}
