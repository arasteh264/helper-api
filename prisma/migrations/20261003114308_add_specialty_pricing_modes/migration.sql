-- CreateEnum
CREATE TYPE "SpecialtyPricingMode" AS ENUM ('QUOTE', 'HOURLY');

-- AlterTable
ALTER TABLE "ServiceRequest" ADD COLUMN     "providerEstimatedHours" DOUBLE PRECISION,
ADD COLUMN     "providerHourlyRateToman" INTEGER,
ADD COLUMN     "providerPricingMode" "SpecialtyPricingMode";

-- AlterTable
ALTER TABLE "Specialty" ADD COLUMN     "hourlyRateToman" INTEGER,
ADD COLUMN     "hourlyUnitLabel" TEXT,
ADD COLUMN     "pricingMode" "SpecialtyPricingMode" NOT NULL DEFAULT 'QUOTE';
