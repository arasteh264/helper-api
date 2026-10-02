-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_userId_key" ON "CustomerProfile"("userId");

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ProviderRequestInvitation_providerProfileId_serviceRequestId_ke" RENAME TO "ProviderRequestInvitation_providerProfileId_serviceRequestI_key";

-- RenameIndex
ALTER INDEX "ProviderRequestInvitation_providerProfileId_status_createdAt_id" RENAME TO "ProviderRequestInvitation_providerProfileId_status_createdA_idx";
