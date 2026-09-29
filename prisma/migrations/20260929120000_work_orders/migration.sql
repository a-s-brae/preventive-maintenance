-- Stage 1: work orders become the core record. PM schedules create work
-- orders; existing work logs are carried over as completed work orders.

-- CreateEnum
CREATE TYPE "WorkOrderType" AS ENUM ('PM', 'REPAIR', 'INSPECTION');
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETE');
CREATE TYPE "Priority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "ScheduleBasis" AS ENUM ('COMPLETION', 'FIXED');

-- PmTask: new scheduling fields
ALTER TABLE "PmTask" ADD COLUMN "defaultAssigneeId" TEXT,
ADD COLUMN "fixedCycle" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "priority" "Priority" NOT NULL DEFAULT 'NONE',
ADD COLUMN "scheduleBasis" "ScheduleBasis" NOT NULL DEFAULT 'COMPLETION';

-- PmTask: checklist text[] -> typed items [{ label, type }]
ALTER TABLE "PmTask" ADD COLUMN "checklist_items" JSONB NOT NULL DEFAULT '[]';
UPDATE "PmTask" SET "checklist_items" = COALESCE(
  (SELECT jsonb_agg(jsonb_build_object('label', item, 'type', 'CHECK') ORDER BY ord)
     FROM unnest("checklist") WITH ORDINALITY AS t(item, ord)),
  '[]'::jsonb);
ALTER TABLE "PmTask" DROP COLUMN "checklist";
ALTER TABLE "PmTask" RENAME COLUMN "checklist_items" TO "checklist";

-- PmTask: startDate used to be the baseline the first interval counted from;
-- it is now the first due date itself, so move it forward one interval.
UPDATE "PmTask" SET "startDate" = "startDate" + ("calendarEvery" || ' ' || lower("calendarUnit"::text))::interval
WHERE "calendarEvery" IS NOT NULL AND "calendarUnit" IS NOT NULL;

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "type" "WorkOrderType" NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'NONE',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assetId" TEXT NOT NULL,
    "pmTaskId" TEXT,
    "openForTaskId" TEXT,
    "cycle" INTEGER,
    "dueDate" TIMESTAMP(3),
    "dueMeter" DOUBLE PRECISION,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "checklistResults" JSONB,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "meterReading" DOUBLE PRECISION,
    "completionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- Carry work logs over as completed work orders, numbered in date order.
INSERT INTO "WorkOrder" ("id", "type", "status", "title", "assetId", "pmTaskId", "checklist", "checklistResults",
  "createdById", "completedAt", "completedById", "meterReading", "completionNotes", "createdAt", "updatedAt")
SELECT
  l."id",
  l."kind"::text::"WorkOrderType",
  'COMPLETE',
  COALESCE(t."title", CASE l."kind" WHEN 'REPAIR' THEN 'Repair' WHEN 'INSPECTION' THEN 'Inspection' ELSE 'Preventive maintenance' END),
  l."assetId",
  l."taskId",
  COALESCE((SELECT jsonb_agg(jsonb_build_object('label', r->>'item', 'type', 'CHECK')) FROM jsonb_array_elements(l."checklistResults") r), '[]'::jsonb),
  (SELECT jsonb_agg(jsonb_build_object('label', r->>'item', 'type', 'CHECK', 'value', (r->>'done')::boolean)) FROM jsonb_array_elements(l."checklistResults") r),
  l."performedById",
  l."performedAt",
  l."performedById",
  l."meterReading",
  l."notes",
  l."createdAt",
  l."createdAt"
FROM "WorkLog" l LEFT JOIN "PmTask" t ON t."id" = l."taskId"
ORDER BY l."performedAt", l."createdAt";

-- DropTable
DROP TABLE "WorkLog";
DROP TYPE "LogKind";

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_number_key" ON "WorkOrder"("number");
CREATE UNIQUE INDEX "WorkOrder_openForTaskId_key" ON "WorkOrder"("openForTaskId");
CREATE INDEX "WorkOrder_status_dueDate_idx" ON "WorkOrder"("status", "dueDate");
CREATE INDEX "WorkOrder_assetId_completedAt_idx" ON "WorkOrder"("assetId", "completedAt");
CREATE INDEX "WorkOrder_pmTaskId_idx" ON "WorkOrder"("pmTaskId");
CREATE INDEX "WorkOrder_assignedToId_idx" ON "WorkOrder"("assignedToId");

-- AddForeignKey
ALTER TABLE "PmTask" ADD CONSTRAINT "PmTask_defaultAssigneeId_fkey" FOREIGN KEY ("defaultAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_pmTaskId_fkey" FOREIGN KEY ("pmTaskId") REFERENCES "PmTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
