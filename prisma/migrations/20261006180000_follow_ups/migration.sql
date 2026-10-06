-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "followUpOfId" TEXT;

-- CreateIndex
CREATE INDEX "WorkOrder_followUpOfId_idx" ON "WorkOrder"("followUpOfId");

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_followUpOfId_fkey" FOREIGN KEY ("followUpOfId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

