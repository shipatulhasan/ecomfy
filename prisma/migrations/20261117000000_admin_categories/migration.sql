-- Admin categories: tree (one level), Media image, active/featured, SEO.
-- Hand-written to keep data: Category.imageUrl → a legacy Media row ("/seed/…"
-- key, rendered by mediaUrl()), and SlugRedirect gains a kind + category FK.

-- CreateEnum
CREATE TYPE "SlugKind" AS ENUM ('PRODUCT', 'CATEGORY');

-- Category: new columns.
ALTER TABLE "Category"
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "imageId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "seoTitle" TEXT,
ADD COLUMN     "seoDescription" TEXT;

-- Backfill: every existing category image becomes a Media row; existing
-- categories were all on Home, so they start featured.
INSERT INTO "Media" ("id", "key", "url", "originalName", "mime", "size", "width", "height", "alt", "createdAt")
SELECT 'cmcat' || md5("id"), "imageUrl", "imageUrl", regexp_replace("imageUrl", '^.*/', ''), 'image/png', 0, 0, 0, "name", now()
FROM "Category"
WHERE "imageUrl" IS NOT NULL
ON CONFLICT ("key") DO NOTHING;

UPDATE "Category" c SET "imageId" = m."id"
FROM "Media" m
WHERE m."key" = c."imageUrl";

UPDATE "Category" SET "isFeatured" = true;

ALTER TABLE "Category" DROP COLUMN "imageUrl";

-- CreateIndex
CREATE INDEX "Category_parentId_sortOrder_idx" ON "Category"("parentId", "sortOrder");
CREATE INDEX "Category_isActive_idx" ON "Category"("isActive");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Category" ADD CONSTRAINT "Category_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SlugRedirect: shared by products and categories.
DROP INDEX "SlugRedirect_fromSlug_key";
ALTER TABLE "SlugRedirect"
ADD COLUMN     "kind" "SlugKind" NOT NULL DEFAULT 'PRODUCT',
ADD COLUMN     "categoryId" TEXT,
ALTER COLUMN   "productId" DROP NOT NULL;

CREATE UNIQUE INDEX "SlugRedirect_kind_fromSlug_key" ON "SlugRedirect"("kind", "fromSlug");
CREATE INDEX "SlugRedirect_categoryId_idx" ON "SlugRedirect"("categoryId");
ALTER TABLE "SlugRedirect" ADD CONSTRAINT "SlugRedirect_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Exactly one target, matching the kind.
ALTER TABLE "SlugRedirect" ADD CONSTRAINT "SlugRedirect_target_check" CHECK (
  ("kind" = 'PRODUCT' AND "productId" IS NOT NULL AND "categoryId" IS NULL) OR
  ("kind" = 'CATEGORY' AND "categoryId" IS NOT NULL AND "productId" IS NULL)
);
