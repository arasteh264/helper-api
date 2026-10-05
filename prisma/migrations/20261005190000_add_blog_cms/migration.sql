CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" VARCHAR(320) NOT NULL,
    "category" TEXT NOT NULL,
    "categorySlug" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "coverImage" TEXT,
    "coverAlt" TEXT,
    "coverTint" TEXT NOT NULL DEFAULT 'from-emerald-500/25 via-emerald-500/10 to-transparent',
    "readingMinutes" INTEGER NOT NULL DEFAULT 1,
    "seoTitle" TEXT,
    "seoDescription" VARCHAR(320),
    "canonicalUrl" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");
CREATE INDEX "BlogPost_status_publishedAt_id_idx" ON "BlogPost"("status", "publishedAt" DESC, "id");
CREATE INDEX "BlogPost_categorySlug_status_publishedAt_idx" ON "BlogPost"("categorySlug", "status", "publishedAt" DESC);
CREATE INDEX "BlogPost_status_updatedAt_idx" ON "BlogPost"("status", "updatedAt" DESC);
