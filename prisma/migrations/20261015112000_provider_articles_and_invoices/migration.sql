CREATE TYPE "ProviderArticleStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT');

CREATE TABLE "ProviderArticle" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" VARCHAR(320) NOT NULL,
    "content" JSONB NOT NULL,
    "coverImage" TEXT,
    "coverPublicId" TEXT,
    "coverAlt" TEXT,
    "readingMinutes" INTEGER NOT NULL DEFAULT 1,
    "status" "ProviderArticleStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewNote" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderArticle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProviderArticleCategory" (
    "articleId" TEXT NOT NULL,
    "specialtyGroupId" TEXT NOT NULL,

    CONSTRAINT "ProviderArticleCategory_pkey" PRIMARY KEY ("articleId", "specialtyGroupId")
);

CREATE TABLE "ProviderArticleSpecialty" (
    "articleId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,

    CONSTRAINT "ProviderArticleSpecialty_pkey" PRIMARY KEY ("articleId", "specialtyId")
);

CREATE TABLE "ProviderArticleRating" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderArticleRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "serviceRequestId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalToman" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Notification" ADD COLUMN "invoiceId" TEXT;

CREATE UNIQUE INDEX "ProviderArticle_slug_key" ON "ProviderArticle"("slug");
CREATE INDEX "ProviderArticle_status_publishedAt_id_idx" ON "ProviderArticle"("status", "publishedAt" DESC, "id");
CREATE INDEX "ProviderArticle_providerProfileId_updatedAt_idx" ON "ProviderArticle"("providerProfileId", "updatedAt" DESC);
CREATE INDEX "ProviderArticleCategory_specialtyGroupId_idx" ON "ProviderArticleCategory"("specialtyGroupId");
CREATE INDEX "ProviderArticleSpecialty_specialtyId_idx" ON "ProviderArticleSpecialty"("specialtyId");
CREATE UNIQUE INDEX "ProviderArticleRating_articleId_userId_key" ON "ProviderArticleRating"("articleId", "userId");
CREATE INDEX "ProviderArticleRating_articleId_createdAt_idx" ON "ProviderArticleRating"("articleId", "createdAt");
CREATE INDEX "ProviderArticleRating_userId_createdAt_idx" ON "ProviderArticleRating"("userId", "createdAt");
CREATE UNIQUE INDEX "Invoice_serviceRequestId_key" ON "Invoice"("serviceRequestId");
CREATE INDEX "Invoice_customerId_status_createdAt_idx" ON "Invoice"("customerId", "status", "createdAt" DESC);
CREATE INDEX "Invoice_providerProfileId_createdAt_idx" ON "Invoice"("providerProfileId", "createdAt" DESC);
CREATE INDEX "Notification_invoiceId_idx" ON "Notification"("invoiceId");

ALTER TABLE "ProviderArticle" ADD CONSTRAINT "ProviderArticle_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderArticle" ADD CONSTRAINT "ProviderArticle_reviewedById_fkey"
FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProviderArticleCategory" ADD CONSTRAINT "ProviderArticleCategory_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "ProviderArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderArticleCategory" ADD CONSTRAINT "ProviderArticleCategory_specialtyGroupId_fkey"
FOREIGN KEY ("specialtyGroupId") REFERENCES "SpecialtyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderArticleSpecialty" ADD CONSTRAINT "ProviderArticleSpecialty_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "ProviderArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderArticleSpecialty" ADD CONSTRAINT "ProviderArticleSpecialty_specialtyId_fkey"
FOREIGN KEY ("specialtyId") REFERENCES "Specialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderArticleRating" ADD CONSTRAINT "ProviderArticleRating_articleId_fkey"
FOREIGN KEY ("articleId") REFERENCES "ProviderArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProviderArticleRating" ADD CONSTRAINT "ProviderArticleRating_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_serviceRequestId_fkey"
FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
