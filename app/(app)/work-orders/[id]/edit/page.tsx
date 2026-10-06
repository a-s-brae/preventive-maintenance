import { requirePermission } from "@/auth";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { deleteWorkOrder, saveWorkOrder } from "@/lib/actions";
import { getAssetTree, getUsers } from "@/lib/queries";
import { woNumber } from "@/lib/work-orders";
import { ConfirmButton } from "@/components/form";
import { WorkOrderForm } from "@/components/work-order-form";
import { Card, PageHeader } from "@/components/ui";

export default async function EditWorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePermission("work");
  const { id } = await params;
  const [workOrder, assets, users] = await Promise.all([
    db.workOrder.findUnique({ where: { id } }),
    getAssetTree(),
    getUsers(),
  ]);
  if (!workOrder) notFound();
  return (
    <>
      <PageHeader title={`Edit ${woNumber(workOrder.number)}`}>
        {workOrder.type !== "PM" && can(me.role, "manage") && (
          <ConfirmButton action={deleteWorkOrder.bind(null, workOrder.id)} message="Delete this work order? This can't be undone.">
            Delete
          </ConfirmButton>
        )}
      </PageHeader>
      <Card>
        <WorkOrderForm action={saveWorkOrder.bind(null, workOrder.id)} workOrder={workOrder} assets={assets} users={users} />
      </Card>
    </>
  );
}
