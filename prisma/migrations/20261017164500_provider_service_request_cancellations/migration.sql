CREATE TYPE "ProviderCancellationReason" AS ENUM (
  'PROJECT_NOT_FOUND',
  'CUSTOMER_UNAVAILABLE',
  'ACCESS_ISSUE',
  'SCOPE_MISMATCH',
  'SAFETY_CONCERN',
  'OTHER'
);

CREATE TYPE "ProviderCancellationStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED'
);

CREATE TABLE "ServiceRequestProviderCancellation" (
  "id" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "reason" "ProviderCancellationReason" NOT NULL,
  "note" TEXT,
  "status" "ProviderCancellationStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "resolvedByUserId" TEXT,
  "decisionNote" TEXT,

  CONSTRAINT "ServiceRequestProviderCancellation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceRequestProviderCancellation_status_requestedAt_idx"
  ON "ServiceRequestProviderCancellation"("status", "requestedAt");

CREATE INDEX "ServiceRequestProviderCancellation_serviceRequestId_status_requestedAt_idx"
  ON "ServiceRequestProviderCancellation"("serviceRequestId", "status", "requestedAt");

ALTER TABLE "ServiceRequestProviderCancellation"
  ADD CONSTRAINT "ServiceRequestProviderCancellation_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRequestProviderCancellation"
  ADD CONSTRAINT "ServiceRequestProviderCancellation_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
