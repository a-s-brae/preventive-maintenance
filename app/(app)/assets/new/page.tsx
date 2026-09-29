import { saveAsset } from "@/lib/actions";
import { AssetForm } from "@/components/asset-form";
import { Card, PageHeader } from "@/components/ui";

export default function NewAssetPage() {
  return (
    <>
      <PageHeader title="New asset" />
      <Card>
        <AssetForm action={saveAsset.bind(null, null)} />
      </Card>
    </>
  );
}
