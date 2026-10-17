CREATE TABLE "ServiceWorkReport" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "materials" JSONB NOT NULL DEFAULT '[]',
    "warrantyDays" INTEGER,
    "warrantyNote" TEXT,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "warrantyExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceWorkReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceWorkReport_serviceRequestId_key"
ON "ServiceWorkReport"("serviceRequestId");

CREATE INDEX "ServiceWorkReport_providerProfileId_completedAt_idx"
ON "ServiceWorkReport"("providerProfileId", "completedAt" DESC);

CREATE INDEX "ServiceWorkReport_warrantyExpiresAt_idx"
ON "ServiceWorkReport"("warrantyExpiresAt");

ALTER TABLE "ServiceWorkReport"
ADD CONSTRAINT "ServiceWorkReport_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceWorkReport"
ADD CONSTRAINT "ServiceWorkReport_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
