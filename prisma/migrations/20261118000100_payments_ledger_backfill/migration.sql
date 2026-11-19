-- Backfill the Payment ledger (admin Transactions).

-- Customer on every row.
UPDATE "Payment" p SET "userId" = o."userId"
FROM "Order" o WHERE o."id" = p."orderId" AND p."userId" IS NULL;

-- Cash on delivery rows are collections, not gateway charges.
UPDATE "Payment" SET "type" = 'COD_COLLECTION' WHERE "method" = 'COD';

-- One REFUND row (negative amount) per manual refund.
WITH numbered AS (
  SELECT r."id" AS refund_id, r."orderId", r."amountCents", r."note", r."createdAt",
         o."orderNumber", o."userId", o."paymentMethod", o."currency",
         ROW_NUMBER() OVER (PARTITION BY r."orderId" ORDER BY r."createdAt", r."id") AS n
  FROM "Refund" r JOIN "Order" o ON o."id" = r."orderId"
  WHERE r."paymentId" IS NULL
), inserted AS (
  INSERT INTO "Payment" ("id", "orderId", "userId", "type", "method", "attempt", "reference",
                         "amountCents", "currency", "status", "raw", "completedAt", "createdAt", "updatedAt")
  SELECT 'rf_' || refund_id, "orderId", "userId", 'REFUND', "paymentMethod", NULL,
         "orderNumber" || '-R' || n, -"amountCents", "currency", 'SUCCEEDED', '[]'::jsonb,
         "createdAt", "createdAt", "createdAt"
  FROM numbered
  RETURNING "id"
)
UPDATE "Refund" r SET "paymentId" = 'rf_' || r."id"
WHERE r."paymentId" IS NULL AND EXISTS (SELECT 1 FROM inserted i WHERE i."id" = 'rf_' || r."id");

-- Fully refunded orders: their settled charge/collection is REFUNDED.
UPDATE "Payment" p SET "status" = 'REFUNDED'
FROM "Order" o
WHERE o."id" = p."orderId" AND o."paymentStatus" = 'REFUNDED'
  AND p."type" <> 'REFUND' AND p."status" = 'SUCCEEDED';
