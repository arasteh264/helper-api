ALTER TYPE "ServiceRequestStatus" ADD VALUE 'PENDING_ADMIN_REVIEW' BEFORE 'OPEN';

ALTER TABLE "WalletConfiguration"
ADD COLUMN "requireServiceRequestReview" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ServiceRequest"
ADD COLUMN "adminReviewNote" TEXT;
