CREATE TYPE "DisputeResolution" AS ENUM ('PROVIDER', 'BUYER');

ALTER TABLE "ServiceRequest"
ADD COLUMN "disputeResolution" "DisputeResolution",
ADD COLUMN "disputeResolutionNote" TEXT,
ADD COLUMN "disputeResolvedById" TEXT,
ADD COLUMN "disputeResolvedAt" TIMESTAMP(3);
