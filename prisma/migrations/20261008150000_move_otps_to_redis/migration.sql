UPDATE "User"
SET "otpCode" = NULL,
    "otpExpiresAt" = NULL;

ALTER TABLE "PendingRegistration"
ALTER COLUMN "otpCode" DROP NOT NULL,
ALTER COLUMN "otpExpiresAt" DROP NOT NULL;

UPDATE "PendingRegistration"
SET "otpCode" = NULL,
    "otpExpiresAt" = NULL;
