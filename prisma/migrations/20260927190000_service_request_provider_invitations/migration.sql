ALTER TABLE "ProviderProfile"
ADD COLUMN "serviceAreaLatitude" DOUBLE PRECISION,
ADD COLUMN "serviceAreaLongitude" DOUBLE PRECISION;

CREATE TYPE "ProviderInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN');

CREATE TABLE "ProviderRequestInvitation" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "status" "ProviderInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  CONSTRAINT "ProviderRequestInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderRequestInvitation_providerProfileId_serviceRequestId_key"
ON "ProviderRequestInvitation"("providerProfileId", "serviceRequestId");

CREATE INDEX "ProviderRequestInvitation_providerProfileId_status_createdAt_idx"
ON "ProviderRequestInvitation"("providerProfileId", "status", "createdAt");

CREATE INDEX "ProviderRequestInvitation_serviceRequestId_status_idx"
ON "ProviderRequestInvitation"("serviceRequestId", "status");

ALTER TABLE "ProviderRequestInvitation"
ADD CONSTRAINT "ProviderRequestInvitation_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderRequestInvitation"
ADD CONSTRAINT "ProviderRequestInvitation_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
