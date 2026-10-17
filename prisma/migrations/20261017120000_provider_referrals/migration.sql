CREATE TYPE "ProviderReferralRewardType" AS ENUM (
  'STORY_PUBLISHING',
  'ARTICLE_PUBLISHING',
  'ZERO_COMMISSION'
);

ALTER TABLE "ProviderProfile"
ADD COLUMN "canPublishArticles" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "commissionExempt" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ProviderProfile" AS profile
SET "canPublishArticles" = true
WHERE EXISTS (
  SELECT 1
  FROM "ProviderArticle" AS article
  WHERE article."providerProfileId" = profile."id"
);

CREATE TABLE "ProviderReferralCode" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProviderReferralCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderReferral" (
  "id" TEXT NOT NULL,
  "referralCodeId" TEXT NOT NULL,
  "referredProviderProfileId" TEXT NOT NULL,
  "rewardType" "ProviderReferralRewardType",
  "rewardedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProviderReferral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderReferralCode_providerProfileId_key"
ON "ProviderReferralCode"("providerProfileId");

CREATE UNIQUE INDEX "ProviderReferralCode_code_key"
ON "ProviderReferralCode"("code");

CREATE UNIQUE INDEX "ProviderReferral_referredProviderProfileId_key"
ON "ProviderReferral"("referredProviderProfileId");

CREATE INDEX "ProviderReferral_referralCodeId_createdAt_idx"
ON "ProviderReferral"("referralCodeId", "createdAt");

CREATE INDEX "ProviderReferral_rewardType_rewardedAt_idx"
ON "ProviderReferral"("rewardType", "rewardedAt");

ALTER TABLE "ProviderReferralCode"
ADD CONSTRAINT "ProviderReferralCode_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderReferral"
ADD CONSTRAINT "ProviderReferral_referralCodeId_fkey"
FOREIGN KEY ("referralCodeId") REFERENCES "ProviderReferralCode"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderReferral"
ADD CONSTRAINT "ProviderReferral_referredProviderProfileId_fkey"
FOREIGN KEY ("referredProviderProfileId") REFERENCES "ProviderProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
