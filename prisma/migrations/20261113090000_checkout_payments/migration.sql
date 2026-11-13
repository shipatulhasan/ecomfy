-- Checkout: BDT money, three payment methods (bKash / SSLCommerz / COD), payment
-- attempts, stock reservation, store settings, shipping zones, gateway tokens.
-- Hand-written: legacy enum values are remapped instead of failing the cast.

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "StockState" AS ENUM ('RESERVED', 'COMMITTED', 'RELEASED');

-- OrderStatus: PENDING → PENDING_CONFIRMATION, CANCELED → CANCELLED
CREATE TYPE "OrderStatus_new" AS ENUM ('PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'EXPIRED', 'FAILED');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new" USING (
  CASE "status"::text
    WHEN 'PENDING' THEN 'PENDING_CONFIRMATION'
    WHEN 'CANCELED' THEN 'CANCELLED'
    ELSE "status"::text
  END
)::"OrderStatus_new";
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING_CONFIRMATION';

-- PaymentMethod: CASH_ON_DELIVERY → COD, every online method → SSLCOMMERZ
CREATE TYPE "PaymentMethod_new" AS ENUM ('BKASH', 'SSLCOMMERZ', 'COD');
ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE "PaymentMethod_new" USING (
  CASE "paymentMethod"::text WHEN 'CASH_ON_DELIVERY' THEN 'COD' ELSE 'SSLCOMMERZ' END
)::"PaymentMethod_new";
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "PaymentMethod_old";

-- PaymentStatus: CANCELED → FAILED
CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PAID', 'FAILED', 'REFUNDED');
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING (
  CASE "paymentStatus"::text WHEN 'CANCELED' THEN 'FAILED' ELSE "paymentStatus"::text END
)::"PaymentStatus_new";
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "PaymentStatus_old";
ALTER TABLE "Order" ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';

-- Address: state → district (kept data), + city, country defaults to Bangladesh
ALTER TABLE "Address" RENAME COLUMN "state" TO "district";
ALTER TABLE "Address" ADD COLUMN "city" TEXT NOT NULL DEFAULT '',
  ALTER COLUMN "country" SET DEFAULT 'Bangladesh';

-- Order
DROP INDEX "Order_status_idx";
ALTER TABLE "Order"
  ADD COLUMN "codFeeCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "codFlagReason" TEXT,
  ADD COLUMN "codFlagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BDT',
  ADD COLUMN "deliveryEstimate" TEXT,
  ADD COLUMN "displayCurrency" TEXT NOT NULL DEFAULT 'BDT',
  ADD COLUMN "displayTotalCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "district" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "fxRate" DECIMAL(10,4) NOT NULL DEFAULT 1,
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "orderNumber" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3),
  ADD COLUMN "placedIp" TEXT,
  ADD COLUMN "shippingZoneName" TEXT,
  ADD COLUMN "stockState" "StockState" NOT NULL DEFAULT 'COMMITTED';
UPDATE "Order" SET
  "orderNumber" = 'ECF-' || lpad("number"::text, 6, '0'),
  "idempotencyKey" = 'legacy-' || "id",
  "displayTotalCents" = "totalCents";
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL, ALTER COLUMN "idempotencyKey" SET NOT NULL;

-- Variant
ALTER TABLE "Variant" ADD COLUMN "reserved" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "attempt" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BDT',
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'INITIATED',
    "paymentId" TEXT,
    "trxId" TEXT,
    "sessionKey" TEXT,
    "valId" TEXT,
    "bankTranId" TEXT,
    "failReason" TEXT,
    "raw" JSONB NOT NULL DEFAULT '[]',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "usdToBdtRate" DECIMAL(10,4) NOT NULL DEFAULT 123,
    "codEnabled" BOOLEAN NOT NULL DEFAULT true,
    "codFeeCents" INTEGER NOT NULL DEFAULT 0,
    "codMaxOrderCents" INTEGER,
    "codAllowedDistricts" TEXT[],
    "codMaxPerPhonePerDay" INTEGER NOT NULL DEFAULT 3,
    "bkashEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sslcommerzEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShippingZone" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rateCents" INTEGER NOT NULL,
    "districts" TEXT[],
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "etaText" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShippingZone_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GatewayToken" (
    "provider" TEXT NOT NULL,
    "idToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GatewayToken_pkey" PRIMARY KEY ("provider")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");
CREATE UNIQUE INDEX "Payment_paymentId_key" ON "Payment"("paymentId");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE UNIQUE INDEX "Payment_orderId_attempt_key" ON "Payment"("orderId", "attempt");
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
CREATE INDEX "Order_status_expiresAt_idx" ON "Order"("status", "expiresAt");
CREATE INDEX "Order_phone_paymentMethod_createdAt_idx" ON "Order"("phone", "paymentMethod", "createdAt");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
