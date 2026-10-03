CREATE TABLE "CustomerWalletTopup" (
    "id" TEXT NOT NULL,
    "customerWalletId" TEXT NOT NULL,
    "amountToman" INTEGER NOT NULL,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'ZARINPAL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "authority" TEXT,
    "referenceId" TEXT,
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerWalletTopup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerWalletTopup_authority_key" ON "CustomerWalletTopup"("authority");
CREATE INDEX "CustomerWalletTopup_customerWalletId_createdAt_idx" ON "CustomerWalletTopup"("customerWalletId", "createdAt");
CREATE INDEX "CustomerWalletTopup_status_createdAt_idx" ON "CustomerWalletTopup"("status", "createdAt");

ALTER TABLE "CustomerWalletTopup"
    ADD CONSTRAINT "CustomerWalletTopup_customerWalletId_fkey"
    FOREIGN KEY ("customerWalletId") REFERENCES "CustomerWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;