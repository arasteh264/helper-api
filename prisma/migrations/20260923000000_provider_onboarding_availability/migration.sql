CREATE TYPE "ProviderVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ProviderDocumentType" AS ENUM ('NATIONAL_CARD', 'BUSINESS_LICENSE', 'CERTIFICATE', 'OTHER');

ALTER TABLE "ProviderProfile"
ADD COLUMN "verificationStatus" "ProviderVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "verificationNote" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "ProviderDocument" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "type" "ProviderDocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderWorkingHour" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderWorkingHour_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderDocument_providerProfileId_createdAt_idx" ON "ProviderDocument"("providerProfileId", "createdAt");
CREATE UNIQUE INDEX "ProviderWorkingHour_providerProfileId_dayOfWeek_key" ON "ProviderWorkingHour"("providerProfileId", "dayOfWeek");
CREATE INDEX "ProviderWorkingHour_dayOfWeek_isActive_idx" ON "ProviderWorkingHour"("dayOfWeek", "isActive");

ALTER TABLE "ProviderDocument" ADD CONSTRAINT "ProviderDocument_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProviderWorkingHour" ADD CONSTRAINT "ProviderWorkingHour_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
