-- CreateTable
CREATE TABLE "PortfolioItem" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioItemImage" (
    "id" TEXT NOT NULL,
    "portfolioItemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioItemImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioItem_providerProfileId_order_idx" ON "PortfolioItem"("providerProfileId", "order");

-- CreateIndex
CREATE INDEX "PortfolioItemImage_portfolioItemId_order_idx" ON "PortfolioItemImage"("portfolioItemId", "order");

-- AddForeignKey
ALTER TABLE "PortfolioItem" ADD CONSTRAINT "PortfolioItem_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioItemImage" ADD CONSTRAINT "PortfolioItemImage_portfolioItemId_fkey" FOREIGN KEY ("portfolioItemId") REFERENCES "PortfolioItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
