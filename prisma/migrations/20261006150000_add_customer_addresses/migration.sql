CREATE TYPE "CustomerAddressType" AS ENUM ('HOME', 'WORK', 'OTHER');

CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CustomerAddressType" NOT NULL DEFAULT 'HOME',
    "receiverName" TEXT NOT NULL,
    "receiverPhone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "fullAddress" TEXT NOT NULL,
    "plaque" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAddress_customerId_isDefault_createdAt_idx"
ON "CustomerAddress"("customerId", "isDefault", "createdAt");

CREATE UNIQUE INDEX "CustomerAddress_customerId_default_key"
ON "CustomerAddress"("customerId")
WHERE "isDefault" = true;

ALTER TABLE "CustomerAddress"
ADD CONSTRAINT "CustomerAddress_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
