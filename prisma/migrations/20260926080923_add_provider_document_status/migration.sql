/*
  Warnings:

  - A unique constraint covering the columns `[providerProfileId,type]` on the table `ProviderDocument` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `ProviderDocument` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ProviderDocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ProviderDocumentType" ADD VALUE 'COMMITMENT_LETTER';

-- AlterTable
ALTER TABLE "ProviderDocument" ADD COLUMN     "rejectionNote" TEXT,
ADD COLUMN     "status" "ProviderDocumentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProviderDocument_providerProfileId_type_key" ON "ProviderDocument"("providerProfileId", "type");
