-- CreateTable
CREATE TABLE "SignInFailure" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignInFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignInFailure_key_createdAt_idx" ON "SignInFailure"("key", "createdAt");

