-- AlterTable
ALTER TABLE "ProviderProfile" ADD COLUMN     "avatarPublicId" TEXT,
ADD COLUMN     "avatarUrl" TEXT;

-- AddForeignKey
ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
