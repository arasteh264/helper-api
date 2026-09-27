ALTER TABLE "ServiceRequest"
ADD COLUMN "acceptedProviderProfileId" TEXT;

CREATE INDEX "ServiceRequest_acceptedProviderProfileId_status_idx"
ON "ServiceRequest"("acceptedProviderProfileId", "status");

ALTER TABLE "ServiceRequest"
ADD CONSTRAINT "ServiceRequest_acceptedProviderProfileId_fkey"
FOREIGN KEY ("acceptedProviderProfileId") REFERENCES "ProviderProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProviderRequestDecline" (
  "providerProfileId" TEXT NOT NULL,
  "serviceRequestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProviderRequestDecline_pkey" PRIMARY KEY ("providerProfileId", "serviceRequestId")
);

CREATE INDEX "ProviderRequestDecline_serviceRequestId_idx"
ON "ProviderRequestDecline"("serviceRequestId");

ALTER TABLE "ProviderRequestDecline"
ADD CONSTRAINT "ProviderRequestDecline_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderRequestDecline"
ADD CONSTRAINT "ProviderRequestDecline_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
