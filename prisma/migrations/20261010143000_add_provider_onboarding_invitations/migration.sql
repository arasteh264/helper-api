CREATE TABLE "ProviderOnboardingInvitation" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "smsSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ProviderOnboardingInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderOnboardingInvitation_tokenHash_key"
ON "ProviderOnboardingInvitation"("tokenHash");

CREATE INDEX "ProviderOnboardingInvitation_phone_createdAt_idx"
ON "ProviderOnboardingInvitation"("phone", "createdAt");

CREATE INDEX "ProviderOnboardingInvitation_expiresAt_usedAt_revokedAt_idx"
ON "ProviderOnboardingInvitation"("expiresAt", "usedAt", "revokedAt");

ALTER TABLE "ProviderOnboardingInvitation"
ADD CONSTRAINT "ProviderOnboardingInvitation_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
