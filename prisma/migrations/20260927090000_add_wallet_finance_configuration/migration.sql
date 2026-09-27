ALTER TYPE "WalletTransactionType" ADD VALUE 'COMMISSION';

CREATE TABLE "WalletConfiguration" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 10,
  "minWithdrawal" INTEGER NOT NULL DEFAULT 100000,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WalletConfiguration_pkey" PRIMARY KEY ("id")
);
