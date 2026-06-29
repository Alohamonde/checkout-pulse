-- CreateTable
CREATE TABLE "OfferRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "triggerType" TEXT NOT NULL DEFAULT 'product',
    "triggerProductId" TEXT NOT NULL DEFAULT '',
    "triggerProductTitle" TEXT NOT NULL DEFAULT '',
    "triggerCollectionId" TEXT NOT NULL DEFAULT '',
    "triggerCollectionTitle" TEXT NOT NULL DEFAULT '',
    "minOrderAmount" REAL NOT NULL DEFAULT 0,
    "offerProductId" TEXT NOT NULL,
    "offerProductTitle" TEXT NOT NULL,
    "offerVariantId" TEXT NOT NULL,
    "discountPercent" REAL NOT NULL DEFAULT 10,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OfferEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "ruleId" TEXT,
    "eventType" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "OfferRule_shop_idx" ON "OfferRule"("shop");

-- CreateIndex
CREATE INDEX "OfferEvent_shop_eventType_idx" ON "OfferEvent"("shop", "eventType");

-- CreateIndex
CREATE INDEX "OfferEvent_shop_ruleId_idx" ON "OfferEvent"("shop", "ruleId");
