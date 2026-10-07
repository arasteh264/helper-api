CREATE TYPE "DisputeReason" AS ENUM (
  'WORK_NOT_COMPLETED',
  'WORK_QUALITY',
  'PRICE_DISAGREEMENT',
  'PROVIDER_NO_SHOW',
  'CUSTOMER_NON_PAYMENT',
  'OTHER'
);

ALTER TABLE "ServiceRequest"
ADD COLUMN "disputeReason" "DisputeReason",
ADD COLUMN "disputeDescription" TEXT,
ADD COLUMN "disputeUpdatedAt" TIMESTAMP(3);

ALTER TABLE "ServiceRequest"
ADD CONSTRAINT "ServiceRequest_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ServiceRequestDisputeMessage" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceRequestDisputeMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceRequestDisputeMessage_serviceRequestId_createdAt_idx"
ON "ServiceRequestDisputeMessage"("serviceRequestId", "createdAt");

CREATE INDEX "ServiceRequestDisputeMessage_authorUserId_createdAt_idx"
ON "ServiceRequestDisputeMessage"("authorUserId", "createdAt");

ALTER TABLE "ServiceRequestDisputeMessage"
ADD CONSTRAINT "ServiceRequestDisputeMessage_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRequestDisputeMessage"
ADD CONSTRAINT "ServiceRequestDisputeMessage_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
