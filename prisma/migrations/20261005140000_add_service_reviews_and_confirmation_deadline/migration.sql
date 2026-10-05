ALTER TABLE "ServiceRequest"
ADD COLUMN "customerConfirmationDeadline" TIMESTAMP(3);

UPDATE "ServiceRequest"
SET "customerConfirmationDeadline" = "updatedAt" + INTERVAL '72 hours'
WHERE "status" = 'AWAITING_CUSTOMER_CONFIRMATION'
  AND "customerConfirmationDeadline" IS NULL;

CREATE TABLE "ServiceRequestReview" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "text" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceRequestReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceRequestReview_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "ServiceRequestReview_serviceRequestId_key"
ON "ServiceRequestReview"("serviceRequestId");

CREATE INDEX "ServiceRequestReview_providerProfileId_createdAt_idx"
ON "ServiceRequestReview"("providerProfileId", "createdAt");

CREATE INDEX "ServiceRequestReview_customerId_createdAt_idx"
ON "ServiceRequestReview"("customerId", "createdAt");

ALTER TABLE "ServiceRequestReview"
ADD CONSTRAINT "ServiceRequestReview_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRequestReview"
ADD CONSTRAINT "ServiceRequestReview_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRequestReview"
ADD CONSTRAINT "ServiceRequestReview_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;