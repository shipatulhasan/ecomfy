-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "priceCents" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Product_status_priceCents_idx" ON "Product"("status", "priceCents");
