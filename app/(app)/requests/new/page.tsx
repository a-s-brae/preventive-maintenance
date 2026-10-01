import { createRequest } from "@/lib/actions";
import { getAssetTree, getLocationTree } from "@/lib/queries";
import { RequestForm } from "@/components/request-forms";
import { Card, PageHeader } from "@/components/ui";

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ assetId?: string }> }) {
  const [{ assetId }, assets, locations] = await Promise.all([searchParams, getAssetTree(), getLocationTree()]);
  return (
    <>
      <PageHeader title="Report a problem" />
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-slate-600">
        Tell maintenance what's wrong. Someone will review it and turn it into a work order.
      </p>
      <Card>
        <RequestForm action={createRequest} assets={assets} locations={locations} defaultAssetId={assetId} />
      </Card>
    </>
  );
}
