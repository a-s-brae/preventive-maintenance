-- Stage 3: roles, parts & stock, labor time, attachments.

-- CreateEnum
CREATE TYPE "StockReason" AS ENUM ('RESTOCK', 'USED', 'RETURNED', 'ADJUST');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'TECH', 'REQUESTER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailDigest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'REQUESTER';

-- CreateTable
CREATE TABLE "Part" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "partNumber" TEXT,
    "description" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'ea',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minQuantity" DOUBLE PRECISION,
    "unitCost" DOUBLE PRECISION,
    "storageLocation" TEXT,
    "vendor" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Part_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartUsage" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "usedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransaction" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "change" DOUBLE PRECISION NOT NULL,
    "quantityAfter" DOUBLE PRECISION NOT NULL,
    "reason" "StockReason" NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "workOrderId" TEXT,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaborEntry" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "minutes" INTEGER,
    "note" TEXT,
    "runningKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaborEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT,
    "assetId" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentData" (
    "attachmentId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "AttachmentData_pkey" PRIMARY KEY ("attachmentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Part_partNumber_key" ON "Part"("partNumber");

-- CreateIndex
CREATE INDEX "Part_active_name_idx" ON "Part"("active", "name");

-- CreateIndex
CREATE INDEX "PartUsage_workOrderId_idx" ON "PartUsage"("workOrderId");

-- CreateIndex
CREATE INDEX "PartUsage_partId_idx" ON "PartUsage"("partId");

-- CreateIndex
CREATE INDEX "StockTransaction_partId_createdAt_idx" ON "StockTransaction"("partId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LaborEntry_runningKey_key" ON "LaborEntry"("runningKey");

-- CreateIndex
CREATE INDEX "LaborEntry_workOrderId_idx" ON "LaborEntry"("workOrderId");

-- CreateIndex
CREATE INDEX "Attachment_workOrderId_idx" ON "Attachment"("workOrderId");

-- CreateIndex
CREATE INDEX "Attachment_assetId_idx" ON "Attachment"("assetId");

-- AddForeignKey
ALTER TABLE "PartUsage" ADD CONSTRAINT "PartUsage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartUsage" ADD CONSTRAINT "PartUsage_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartUsage" ADD CONSTRAINT "PartUsage_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_partId_fkey" FOREIGN KEY ("partId") REFERENCES "Part"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborEntry" ADD CONSTRAINT "LaborEntry_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaborEntry" ADD CONSTRAINT "LaborEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachmentData" ADD CONSTRAINT "AttachmentData_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- People already using the system keep working: the first account becomes an
-- admin and everyone else a tech. New sign-ins start as requesters.
UPDATE "User" SET "role" = 'TECH';
UPDATE "User" SET "role" = 'ADMIN' WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt", "id" LIMIT 1);
