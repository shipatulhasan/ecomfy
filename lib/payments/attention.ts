import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * "Needs attention" rules for the admin Transactions page, in one SQL query so the
 * list filter, the row/sheet reasons and the sidebar badge always agree:
 *   - stuck: an online attempt INITIATED / PENDING for more than 30 minutes;
 *   - paid_on_closed: a SUCCEEDED charge on a cancelled / expired / failed order not fully refunded;
 *   - amount_mismatch: a SUCCEEDED charge / COD collection whose amount ≠ the order total;
 *   - duplicate: more than one SUCCEEDED charge for an order, beyond what was refunded.
 * Callers check `payments:read` first.
 */
export { ATTENTION_LABELS, ATTENTION_REASONS, type AttentionReason } from "./attention-labels";
import type { AttentionReason } from "./attention-labels";

export const STUCK_AFTER_MIN = 30;

type Row = { id: string; reason: AttentionReason };

/** Every flagged payment with its reasons (a payment can match several). `ids` narrows it. */
export async function attentionRows(ids?: readonly string[]): Promise<Map<string, AttentionReason[]>> {
  if (ids && ids.length === 0) return new Map();
  const rows = await prisma.$queryRaw<Row[]>`
    WITH flagged AS (
      SELECT p."id", 'stuck' AS reason
      FROM "Payment" p
      WHERE p."method" <> 'COD' AND p."type" = 'CHARGE'
        AND p."status" IN ('INITIATED', 'PENDING')
        AND p."createdAt" < now() - make_interval(mins => ${STUCK_AFTER_MIN})
      UNION ALL
      SELECT p."id", 'paid_on_closed'
      FROM "Payment" p JOIN "Order" o ON o."id" = p."orderId"
      WHERE p."type" = 'CHARGE' AND p."status" = 'SUCCEEDED'
        AND o."status" IN ('CANCELLED', 'EXPIRED', 'FAILED')
        AND o."refundedCents" < o."totalCents"
      UNION ALL
      SELECT p."id", 'amount_mismatch'
      FROM "Payment" p JOIN "Order" o ON o."id" = p."orderId"
      WHERE p."type" IN ('CHARGE', 'COD_COLLECTION') AND p."status" = 'SUCCEEDED'
        AND p."amountCents" <> o."totalCents"
      UNION ALL
      SELECT p."id", 'duplicate'
      FROM "Payment" p
      JOIN (
        SELECT c."orderId"
        FROM "Payment" c JOIN "Order" o ON o."id" = c."orderId"
        WHERE c."type" = 'CHARGE' AND c."status" = 'SUCCEEDED'
        GROUP BY c."orderId", o."totalCents", o."refundedCents"
        HAVING count(*) > 1 AND sum(c."amountCents") - o."refundedCents" > o."totalCents"
      ) d ON d."orderId" = p."orderId"
      WHERE p."type" = 'CHARGE' AND p."status" = 'SUCCEEDED'
    )
    SELECT "id", reason FROM flagged
    ${ids ? Prisma.sql`WHERE "id" IN (${Prisma.join(ids)})` : Prisma.empty}`;
  const map = new Map<string, AttentionReason[]>();
  for (const r of rows) map.set(r.id, [...(map.get(r.id) ?? []), r.reason]);
  return map;
}
