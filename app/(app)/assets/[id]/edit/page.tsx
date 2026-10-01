import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteAsset, saveAsset } from "@/lib/actions";
import { getAssetTree, getLocationTree } from "@/lib/queries";
import { descendantIds } from "@/lib/tree";
import { AssetForm } from "@/components/asset-form";
import { ConfirmButton } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [asset, locations, tree] = await Promise.all([db.asset.findUnique({ where: { id } }), getLocationTree(), getAssetTree()]);
  if (!asset) notFound();
  // It can't sit under itself or anything below it.
  const own = descendantIds(tree, asset.id);
  return (
    <>
      <PageHeader title={`Edit ${asset.name}`}>
        <ConfirmButton
          action={deleteAsset.bind(null, asset.id)}
          message="Delete this asset and ALL of its PM schedules, work orders and history? Its sub-assets move to the top level. Consider setting it to Retired instead."
        >
          Delete asset
        </ConfirmButton>
      </PageHeader>
      <Card>
        <AssetForm action={saveAsset.bind(null, asset.id)} asset={asset} locations={locations} parents={tree.filter((a) => !own.has(a.id))} />
      </Card>
    </>
  );
}
