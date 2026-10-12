ALTER TABLE "Specialty"
ADD COLUMN "allowsQuoteItems" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ServiceRequest"
ADD COLUMN "providerLaborPriceToman" INTEGER,
ADD COLUMN "providerQuoteNote" TEXT,
ADD COLUMN "providerQuoteItems" JSONB NOT NULL DEFAULT '[]';

CREATE TABLE "ServiceRequestQuote" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "laborPriceToman" INTEGER NOT NULL,
    "totalPriceToman" INTEGER NOT NULL,
    "quoteNote" TEXT NOT NULL,
    "estimatedHours" DOUBLE PRECISION,
    "pricingMode" "SpecialtyPricingMode" NOT NULL,
    "hourlyRateToman" INTEGER,
    "hourlyUnitLabel" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceRequestQuote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceRequestQuote_serviceRequestId_providerProfileId_key"
ON "ServiceRequestQuote"("serviceRequestId", "providerProfileId");
CREATE INDEX "ServiceRequestQuote_serviceRequestId_createdAt_idx"
ON "ServiceRequestQuote"("serviceRequestId", "createdAt");

ALTER TABLE "ServiceRequestQuote"
ADD CONSTRAINT "ServiceRequestQuote_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceRequestQuote"
ADD CONSTRAINT "ServiceRequestQuote_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
