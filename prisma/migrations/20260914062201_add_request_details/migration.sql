-- CreateEnum
CREATE TYPE "PreferredTime" AS ENUM ('URGENT', 'THIS_WEEK', 'FLEXIBLE');

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "address" TEXT,
ADD COLUMN     "budgetMax" DOUBLE PRECISION,
ADD COLUMN     "budgetMin" DOUBLE PRECISION,
ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "preferredTime" "PreferredTime";

-- CreateTable
CREATE TABLE "ServiceRequestImage" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceRequestImage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ServiceRequestImage" ADD CONSTRAINT "ServiceRequestImage_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
