ALTER TABLE "ServiceRequestPriceAdjustment"
ALTER COLUMN "status" SET DEFAULT 'PENDING_SUPPORT_REVIEW';

UPDATE "ServiceRequestPriceAdjustment"
SET "status" = 'PENDING_SUPPORT_REVIEW'
WHERE "status" = 'PENDING';

ALTER TABLE "ServiceRequestPriceAdjustment"
ADD COLUMN "reviewNote" TEXT,
ADD COLUMN "reviewedAt" TIMESTAMP(3);
