import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { deleteAsset, saveAsset } from "@/lib/actions";
import { AssetForm } from "@/components/asset-form";
import { ConfirmButton } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });
  if (!asset) notFound();
  return (
    <>
      <PageHeader title={`Edit ${asset.name}`}>
        <ConfirmButton
          action={deleteAsset.bind(null, asset.id)}
          message="Delete this asset and ALL of its PM tasks and history? Consider setting it to Retired instead."
        >
          Delete asset
        </ConfirmButton>
      </PageHeader>
      <Card>
        <AssetForm action={saveAsset.bind(null, asset.id)} asset={asset} />
      </Card>
    </>
  );
}
