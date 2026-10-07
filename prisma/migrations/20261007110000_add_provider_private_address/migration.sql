CREATE TYPE "ProviderAddressType" AS ENUM ('HOME', 'BUSINESS');

ALTER TABLE "ProviderProfile"
ADD COLUMN "providerAddress" TEXT,
ADD COLUMN "providerAddressType" "ProviderAddressType" NOT NULL DEFAULT 'HOME';
