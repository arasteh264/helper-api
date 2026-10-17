CREATE TYPE "PriceAdjustmentStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PAID'
);

CREATE TABLE "ServiceRequestPriceAdjustment" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "proposedByUserId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "items" JSONB NOT NULL,
  "previousTotalToman" INTEGER NOT NULL,
  "newTotalToman" INTEGER NOT NULL,
  "amountToman" INTEGER NOT NULL,
  "status" "PriceAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
  "respondedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ServiceRequestPriceAdjustment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Payment"
ADD COLUMN "priceAdjustmentId" TEXT;

CREATE INDEX "ServiceRequestPriceAdjustment_serviceRequestId_createdAt_idx"
ON "ServiceRequestPriceAdjustment"("serviceRequestId", "createdAt");

CREATE INDEX "ServiceRequestPriceAdjustment_status_createdAt_idx"
ON "ServiceRequestPriceAdjustment"("status", "createdAt");

CREATE INDEX "Payment_priceAdjustmentId_createdAt_idx"
ON "Payment"("priceAdjustmentId", "createdAt");

ALTER TABLE "ServiceRequestPriceAdjustment"
ADD CONSTRAINT "ServiceRequestPriceAdjustment_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_priceAdjustmentId_fkey"
FOREIGN KEY ("priceAdjustmentId") REFERENCES "ServiceRequestPriceAdjustment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
