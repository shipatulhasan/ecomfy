/**
 * pnpm tsx scripts/check-payments.ts
 * Independent SQL check for admin Transactions: the KPI totals for the last 7
 * Asia/Dhaka days (compare with the cards) and the number of rows per "needs
 * attention" rule (compare with the menu badge and ?attention=1). Plain SQL on
 * purpose, so it doesn't share code with lib/queries/admin/transactions.ts.
 */
import { prisma } from "./lib-db";

type Row = Record<string, bigint | number | string | null>;
const n = (v: unknown) => Number(v ?? 0);
const taka = (cents: unknown) => `৳${(n(cents) / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

async function main() {
  const [range] = await prisma.$queryRaw<Row[]>`
    SELECT ((date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') - interval '6 days') AT TIME ZONE 'Asia/Dhaka') AS start,
           ((date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') + interval '1 day') AT TIME ZONE 'Asia/Dhaka') AS "end"`;
  const start = range!.start as unknown as Date;
  const end = range!.end as unknown as Date;

  const [money] = await prisma.$queryRaw<Row[]>`
    SELECT
      COALESCE(SUM("amountCents") FILTER (WHERE "type" IN ('CHARGE','COD_COLLECTION') AND "status" IN ('SUCCEEDED','REFUNDED')), 0) AS gross,
      COALESCE(-SUM("amountCents") FILTER (WHERE "type" = 'REFUND' AND "status" = 'SUCCEEDED'), 0) AS refunds,
      COUNT(*) FILTER (WHERE "type" = 'REFUND' AND "status" = 'SUCCEEDED') AS refund_count
    FROM "Payment" WHERE "completedAt" >= ${start} AND "completedAt" < ${end}`;
  const [counts] = await prisma.$queryRaw<Row[]>`
    SELECT
      COUNT(*) FILTER (WHERE "status" IN ('SUCCEEDED','REFUNDED')) AS completed,
      COUNT(*) FILTER (WHERE "status" IN ('INITIATED','PENDING')) AS pending,
      COUNT(*) FILTER (WHERE "status" IN ('FAILED','CANCELLED','EXPIRED')) AS failed
    FROM "Payment" WHERE "type" <> 'REFUND' AND "createdAt" >= ${start} AND "createdAt" < ${end}`;

  console.log(`Last 7 days (Asia/Dhaka): ${start.toISOString()} → ${end.toISOString()}`);
  console.table({
    "Total Revenue (net)": taka(n(money!.gross) - n(money!.refunds)),
    "  money in": taka(money!.gross),
    "  refunded": `${taka(money!.refunds)} (${n(money!.refund_count)})`,
    "Completed Transactions": n(counts!.completed),
    "Pending Transactions": n(counts!.pending),
    "Failed Transactions": n(counts!.failed),
  });

  const [attention] = await prisma.$queryRaw<Row[]>`
    SELECT
      (SELECT COUNT(*) FROM "Payment" WHERE "method" <> 'COD' AND "type" = 'CHARGE' AND "status" IN ('INITIATED','PENDING')
         AND "createdAt" < now() - interval '30 minutes') AS stuck,
      (SELECT COUNT(*) FROM "Payment" p JOIN "Order" o ON o."id" = p."orderId"
         WHERE p."type" = 'CHARGE' AND p."status" = 'SUCCEEDED' AND o."status" IN ('CANCELLED','EXPIRED','FAILED')
           AND o."refundedCents" < o."totalCents") AS paid_on_closed,
      (SELECT COUNT(*) FROM "Payment" p JOIN "Order" o ON o."id" = p."orderId"
         WHERE p."type" IN ('CHARGE','COD_COLLECTION') AND p."status" = 'SUCCEEDED' AND p."amountCents" <> o."totalCents") AS amount_mismatch,
      (SELECT COUNT(*) FROM "Payment" p WHERE p."type" = 'CHARGE' AND p."status" = 'SUCCEEDED' AND p."orderId" IN (
         SELECT c."orderId" FROM "Payment" c JOIN "Order" o ON o."id" = c."orderId"
         WHERE c."type" = 'CHARGE' AND c."status" = 'SUCCEEDED'
         GROUP BY c."orderId", o."totalCents", o."refundedCents"
         HAVING COUNT(*) > 1 AND SUM(c."amountCents") - o."refundedCents" > o."totalCents")) AS duplicate`;
  console.log("Needs attention (rows per rule; a row can match several):");
  console.table(Object.fromEntries(Object.entries(attention!).map(([k, v]) => [k, n(v)])));

  const [ledger] = await prisma.$queryRaw<Row[]>`
    SELECT COUNT(*) AS rows,
      COUNT(*) FILTER (WHERE "type" = 'CHARGE') AS charges,
      COUNT(*) FILTER (WHERE "type" = 'COD_COLLECTION') AS cod,
      COUNT(*) FILTER (WHERE "type" = 'REFUND') AS refunds,
      COUNT(*) FILTER (WHERE "type" = 'REFUND' AND "amountCents" >= 0) AS refunds_not_negative,
      (SELECT COUNT(*) FROM "Refund" WHERE "paymentId" IS NULL) AS refunds_unlinked
    FROM "Payment"`;
  console.log("Ledger:");
  console.table(Object.fromEntries(Object.entries(ledger!).map(([k, v]) => [k, n(v)])));
}

main().finally(() => prisma.$disconnect());
