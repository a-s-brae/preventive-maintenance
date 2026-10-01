import { db } from "@/lib/db";
import { saveWorkOrder } from "@/lib/actions";
import { getAssetTree, getUsers } from "@/lib/queries";
import { WorkOrderForm } from "@/components/work-order-form";
import { Card, PageHeader } from "@/components/ui";

export default async function NewWorkOrderPage({ searchParams }: { searchParams: Promise<{ assetId?: string }> }) {
  const { assetId } = await searchParams;
  const [assets, users] = await Promise.all([
    getAssetTree(),
    getUsers(),
  ]);
  return (
    <>
      <PageHeader title="New work order" />
      <Card>
        <WorkOrderForm action={saveWorkOrder.bind(null, null)} assets={assets} users={users} defaultAssetId={assetId} />
      </Card>
    </>
  );
}
