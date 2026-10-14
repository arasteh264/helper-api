ALTER TABLE "ProviderProfile"
ADD COLUMN "canPublishStories" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "canViewStoryStats" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "WalletTransactionType" ADD VALUE 'STORY_PROMOTION';
ALTER TYPE "ProviderStoryApprovalAction" ADD VALUE 'SET_PRICING';
ALTER TYPE "ProviderStoryMonetizationStatus" ADD VALUE 'PAYMENT_REQUIRED';

ALTER TABLE "ProviderStoryPayment"
ADD COLUMN "providerProfileId" TEXT,
ADD COLUMN "paidByUserId" TEXT,
ADD COLUMN "walletTransactionId" TEXT;

CREATE UNIQUE INDEX "ProviderStoryPayment_storyId_key"
ON "ProviderStoryPayment"("storyId");

CREATE UNIQUE INDEX "ProviderStoryPayment_walletTransactionId_key"
ON "ProviderStoryPayment"("walletTransactionId");

ALTER TABLE "ProviderStoryPayment"
ADD CONSTRAINT "ProviderStoryPayment_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ProviderStoryPayment_paidByUserId_fkey"
FOREIGN KEY ("paidByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "ProviderStoryPayment_walletTransactionId_fkey"
FOREIGN KEY ("walletTransactionId") REFERENCES "WalletTransaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
