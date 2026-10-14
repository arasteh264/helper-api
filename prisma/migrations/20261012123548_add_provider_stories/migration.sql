-- CreateEnum
CREATE TYPE "ProviderStoryMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "ProviderStoryStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProviderStoryMonetizationStatus" AS ENUM ('FREE', 'PENDING_ADMIN_SETUP', 'PAID');

-- CreateEnum
CREATE TYPE "ProviderStoryApprovalAction" AS ENUM ('APPROVE', 'REJECT', 'FLAG');

-- CreateTable
CREATE TABLE "ProviderStory" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "mediaType" "ProviderStoryMediaType" NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaPublicId" TEXT,
    "thumbnailUrl" TEXT,
    "thumbnailPublicId" TEXT,
    "durationSeconds" INTEGER,
    "status" "ProviderStoryStatus" NOT NULL DEFAULT 'DRAFT',
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "priceToman" INTEGER,
    "monetizationStatus" "ProviderStoryMonetizationStatus" NOT NULL DEFAULT 'FREE',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderStory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderStoryView" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "viewerUserId" TEXT,
    "viewerType" TEXT NOT NULL,
    "ipAddress" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderStoryView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderStoryApprovalLog" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" "ProviderStoryApprovalAction" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderStoryApprovalLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderStoryStat" (
    "storyId" TEXT NOT NULL,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueViewers" INTEGER NOT NULL DEFAULT 0,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderStoryStat_pkey" PRIMARY KEY ("storyId")
);

-- CreateTable
CREATE TABLE "ProviderStoryPayment" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "priceToman" INTEGER NOT NULL,
    "paidByAdminId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderStoryPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderStory_providerProfileId_status_createdAt_idx" ON "ProviderStory"("providerProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderStory_status_expiresAt_createdAt_idx" ON "ProviderStory"("status", "expiresAt", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderStory_createdAt_idx" ON "ProviderStory"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderStoryView_storyId_viewedAt_idx" ON "ProviderStoryView"("storyId", "viewedAt");

-- CreateIndex
CREATE INDEX "ProviderStoryView_viewerUserId_viewedAt_idx" ON "ProviderStoryView"("viewerUserId", "viewedAt");

-- CreateIndex
CREATE INDEX "ProviderStoryApprovalLog_storyId_createdAt_idx" ON "ProviderStoryApprovalLog"("storyId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderStoryApprovalLog_adminId_createdAt_idx" ON "ProviderStoryApprovalLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderStoryStat_storyId_idx" ON "ProviderStoryStat"("storyId");

-- CreateIndex
CREATE INDEX "ProviderStoryPayment_storyId_createdAt_idx" ON "ProviderStoryPayment"("storyId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderStoryPayment_status_createdAt_idx" ON "ProviderStoryPayment"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProviderStory" ADD CONSTRAINT "ProviderStory_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderStory" ADD CONSTRAINT "ProviderStory_reviewedByAdminId_fkey" FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderStoryView" ADD CONSTRAINT "ProviderStoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "ProviderStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderStoryApprovalLog" ADD CONSTRAINT "ProviderStoryApprovalLog_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "ProviderStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderStoryApprovalLog" ADD CONSTRAINT "ProviderStoryApprovalLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderStoryStat" ADD CONSTRAINT "ProviderStoryStat_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "ProviderStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderStoryPayment" ADD CONSTRAINT "ProviderStoryPayment_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "ProviderStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderStoryPayment" ADD CONSTRAINT "ProviderStoryPayment_paidByAdminId_fkey" FOREIGN KEY ("paidByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
