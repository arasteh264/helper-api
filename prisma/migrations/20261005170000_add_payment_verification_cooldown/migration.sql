ALTER TABLE "Payment"
ADD COLUMN "lastVerificationAttemptAt" TIMESTAMP(3);

ALTER TABLE "CustomerWalletTopup"
ADD COLUMN "lastVerificationAttemptAt" TIMESTAMP(3);
