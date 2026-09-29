import { db } from "@/lib/db";
import { saveWorkOrder } from "@/lib/actions";
import { getUsers } from "@/lib/queries";
import { WorkOrderForm } from "@/components/work-order-form";
import { Card, PageHeader } from "@/components/ui";

export default async function NewWorkOrderPage({ searchParams }: { searchParams: Promise<{ assetId?: string }> }) {
  const { assetId } = await searchParams;
  const [assets, users] = await Promise.all([
    db.asset.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { name: "asc" }, select: { id: true, name: true, assetTag: true } }),
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
