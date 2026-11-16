-- Admin products + media (Neon Object Storage). Hand-written to keep data:
-- ACTIVE → PUBLISHED, code → sku, ProductImage url/alt/size → Media rows.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "StockStatus" AS ENUM ('IN_STOCK', 'OUT_OF_STOCK');

-- ProductStatus: ACTIVE → PUBLISHED (rename keeps every row), default DRAFT.
ALTER TYPE "ProductStatus" RENAME VALUE 'ACTIVE' TO 'PUBLISHED';
ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- Product: code → sku, new admin fields.
ALTER TABLE "Product" RENAME COLUMN "code" TO "sku";
ALTER INDEX "Product_code_key" RENAME TO "Product_sku_key";
ALTER TABLE "Product"
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "lowStockThreshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "saleStartsAt" TIMESTAMP(3),
ADD COLUMN     "seoDescription" TEXT,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "stockStatus" "StockStatus" NOT NULL DEFAULT 'IN_STOCK',
ADD COLUMN     "taxIncluded" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "trackInventory" BOOLEAN NOT NULL DEFAULT true;

-- Settings
ALTER TABLE "Settings" ADD COLUMN     "maxUploadMb" INTEGER NOT NULL DEFAULT 5;

-- Variant: regular / sale price (priceCents stays the derived selling price).
ALTER TABLE "Variant" ADD COLUMN     "regularPriceCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "salePriceCents" INTEGER;
UPDATE "Variant" SET
  "regularPriceCents" = COALESCE("compareAtCents", "priceCents"),
  "salePriceCents" = CASE WHEN "compareAtCents" IS NOT NULL AND "compareAtCents" > "priceCents" THEN "priceCents" END;

-- CreateTable
CREATE TABLE "SlugRedirect" (
    "id" TEXT NOT NULL,
    "fromSlug" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "alt" TEXT NOT NULL DEFAULT '',
    "blurDataURL" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- Backfill: one Media row per distinct legacy url (key = the site-relative url).
INSERT INTO "Media" ("id", "key", "url", "originalName", "mime", "size", "width", "height", "alt")
SELECT DISTINCT ON (i."url")
  'legacy_' || md5(i."url"), i."url", i."url",
  regexp_replace(i."url", '^.*/', ''),
  CASE WHEN i."url" ~* '\.webp$' THEN 'image/webp' WHEN i."url" ~* '\.jpe?g$' THEN 'image/jpeg' ELSE 'image/png' END,
  0, i."width", i."height", i."alt"
FROM "ProductImage" i
ORDER BY i."url", i."position";

-- ProductImage → join table. Duplicate (product, url) rows are dropped.
ALTER TABLE "ProductImage"
ADD COLUMN     "mediaId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "variantId" TEXT;
UPDATE "ProductImage" SET "mediaId" = 'legacy_' || md5("url"), "sortOrder" = "position";
DELETE FROM "ProductImage" a USING "ProductImage" b
  WHERE a."productId" = b."productId" AND a."url" = b."url" AND (a."position", a."id") > (b."position", b."id");
DROP INDEX "ProductImage_productId_idx";
ALTER TABLE "ProductImage" DROP COLUMN "alt",
DROP COLUMN "height",
DROP COLUMN "position",
DROP COLUMN "url",
DROP COLUMN "width",
ALTER COLUMN "mediaId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "SlugRedirect_fromSlug_key" ON "SlugRedirect"("fromSlug");
CREATE INDEX "SlugRedirect_productId_idx" ON "SlugRedirect"("productId");
CREATE UNIQUE INDEX "Media_key_key" ON "Media"("key");
CREATE INDEX "Media_createdAt_idx" ON "Media"("createdAt");
CREATE INDEX "Media_originalName_idx" ON "Media"("originalName");
CREATE INDEX "Product_status_idx" ON "Product"("status");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");
CREATE INDEX "Product_name_trgm_idx" ON "Product" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Product_sku_trgm_idx" ON "Product" USING GIN ("sku" gin_trgm_ops);
CREATE INDEX "ProductImage_productId_sortOrder_idx" ON "ProductImage"("productId", "sortOrder");
CREATE INDEX "ProductImage_mediaId_idx" ON "ProductImage"("mediaId");
CREATE UNIQUE INDEX "ProductImage_productId_mediaId_key" ON "ProductImage"("productId", "mediaId");

-- AddForeignKey
ALTER TABLE "SlugRedirect" ADD CONSTRAINT "SlugRedirect_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
