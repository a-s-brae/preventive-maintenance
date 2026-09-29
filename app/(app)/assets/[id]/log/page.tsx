import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { logWork } from "@/lib/actions";
import { LogForm } from "@/components/log-form";
import { Card, PageHeader } from "@/components/ui";

export default async function LogWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = await db.asset.findUnique({ where: { id } });
  if (!asset) notFound();
  return (
    <>
      <PageHeader title={`Log work — ${asset.name}`} />
      <Card>
        <LogForm
          action={logWork.bind(null, { assetId: asset.id, taskId: null })}
          meterUnit={asset.meterUnit}
          currentMeter={asset.currentMeter}
        />
      </Card>
    </>
  );
}
