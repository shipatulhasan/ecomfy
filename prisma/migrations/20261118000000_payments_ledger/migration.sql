-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CHARGE', 'REFUND', 'COD_COLLECTION');

-- AlterEnum
ALTER TYPE "PaymentAttemptStatus" ADD VALUE 'REFUNDED';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cardBrand" TEXT,
ADD COLUMN     "cardIssuer" TEXT,
ADD COLUMN     "feeCents" INTEGER,
ADD COLUMN     "type" "PaymentType" NOT NULL DEFAULT 'CHARGE',
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "attempt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "paymentId" TEXT;

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_method_idx" ON "Payment"("method");

-- CreateIndex
CREATE INDEX "Payment_type_idx" ON "Payment"("type");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_paymentId_key" ON "Refund"("paymentId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

