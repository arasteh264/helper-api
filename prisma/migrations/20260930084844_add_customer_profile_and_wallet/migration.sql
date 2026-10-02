-- CreateTable
CREATE TABLE "CustomerWallet" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerWallet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerWallet_customerProfileId_key" ON "CustomerWallet"("customerProfileId");

-- AddForeignKey
ALTER TABLE "CustomerWallet" ADD CONSTRAINT "CustomerWallet_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
