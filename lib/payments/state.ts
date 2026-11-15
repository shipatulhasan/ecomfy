import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { PENDING_PAYMENT_TTL_MIN, paymentMethodMeta, paymentReference } from "@/lib/config/checkout";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { sendMail } from "@/lib/mail";
import { formatPrice } from "@/lib/money";
import { recordStatus } from "@/lib/orders/history";
import { paymentLog, paymentWarn, type LogEntry } from "./log";
import type { CallbackResult } from "./types";

/**
 * Provider-agnostic payment state machine. Every transition is a conditional
 * update on the current status, so repeated / concurrent callbacks (bKash
 * duplicate callback, SSLCommerz redirect + IPN) are processed exactly once:
 * the loser's update matches 0 rows and becomes a no-op.
 *
 * Stock: placeOrder reserves (Variant.reserved += q, Order.stockState RESERVED).
 * Paid → committed (stock -= q, reserved -= q). Failed / cancelled / expired →
 * released (reserved -= q). COD keeps the reservation until an admin ships or
 * cancels it. Coupon usage follows the reservation (+1 reserve, −1 release).
 */

type Tx = Prisma.TransactionClient;

const OPEN_ATTEMPT = ["INITIATED", "PENDING"] as const;

// ───────────────────────────── stock ─────────────────────────────

/** Hold stock for every line; throws StockError if any line can't be held. */
export class StockError extends Error {
  constructor(public productName: string) {
    super(`Sorry, ${productName} no longer has enough stock.`);
  }
}

export async function reserveStock(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { stockState: true, couponId: true, items: { select: { variantId: true, quantity: true, productName: true } } },
  });
  if (order.stockState === "RESERVED") return;
  for (const item of order.items) {
    if (!item.variantId) throw new StockError(item.productName);
    const n = await tx.$executeRaw`
      UPDATE "Variant" SET "reserved" = "reserved" + ${item.quantity}
      WHERE "id" = ${item.variantId} AND "stock" - "reserved" >= ${item.quantity}`;
    if (n !== 1) throw new StockError(item.productName);
  }
  await tx.order.update({ where: { id: orderId }, data: { stockState: "RESERVED" } });
  if (order.couponId) await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
}

/** RESERVED → RELEASED (idempotent). */
export async function releaseStock(tx: Tx, orderId: string) {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, stockState: "RESERVED" },
    data: { stockState: "RELEASED" },
  });
  if (claimed.count !== 1) return;
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { couponId: true, items: { select: { variantId: true, quantity: true } } },
  });
  for (const item of order.items) {
    if (!item.variantId) continue;
    await tx.$executeRaw`
      UPDATE "Variant" SET "reserved" = GREATEST(0, "reserved" - ${item.quantity}) WHERE "id" = ${item.variantId}`;
  }
  if (order.couponId) {
    await tx.$executeRaw`
      UPDATE "Coupon" SET "usedCount" = GREATEST(0, "usedCount" - 1) WHERE "id" = ${order.couponId}`;
  }
}

/**
 * RESERVED → COMMITTED (decrement stock). A late success on a RELEASED order
 * (expired, then paid) takes stock directly if it's there; otherwise the order
 * is still marked paid (money must never be lost) and flagged in the logs.
 */
async function commitStock(tx: Tx, orderId: string, tag: string): Promise<LogEntry | null> {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { stockState: true, couponId: true, items: { select: { variantId: true, quantity: true } } },
  });
  if (order.stockState === "COMMITTED") return null;
  let short = false;
  for (const item of order.items) {
    if (!item.variantId) continue;
    if (order.stockState === "RESERVED") {
      await tx.$executeRaw`
        UPDATE "Variant" SET "stock" = GREATEST(0, "stock" - ${item.quantity}),
          "reserved" = GREATEST(0, "reserved" - ${item.quantity})
        WHERE "id" = ${item.variantId}`;
    } else {
      const n = await tx.$executeRaw`
        UPDATE "Variant" SET "stock" = "stock" - ${item.quantity}
        WHERE "id" = ${item.variantId} AND "stock" - "reserved" >= ${item.quantity}`;
      if (n !== 1) short = true;
    }
  }
  if (order.stockState === "RELEASED" && order.couponId) {
    await tx.coupon.update({ where: { id: order.couponId }, data: { usedCount: { increment: 1 } } });
  }
  await tx.order.update({ where: { id: orderId }, data: { stockState: "COMMITTED" } });
  return short ? paymentWarn(tag, "late-payment-stock-short", { orderId, action: "review / refund" }) : null;
}

// ───────────────────────────── cart ─────────────────────────────

/** Remove the ordered lines (and the coupon) from the cart the order came from. */
export async function clearOrderedCart(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { cartId: true, couponId: true, items: { select: { variantId: true } } },
  });
  if (!order.cartId) return;
  const variantIds = order.items.flatMap((i) => (i.variantId ? [i.variantId] : []));
  await tx.cartItem.deleteMany({ where: { cartId: order.cartId, variantId: { in: variantIds } } });
  if (order.couponId) {
    await tx.cart.updateMany({ where: { id: order.cartId, couponId: order.couponId }, data: { couponId: null } });
  }
}

// ───────────────────────────── attempts ─────────────────────────────

const toJsonArray = (raw: Prisma.JsonValue): Prisma.InputJsonValue[] =>
  Array.isArray(raw) ? (raw as Prisma.InputJsonValue[]) : [];

export async function appendPaymentLog(paymentId: string, ...entries: (LogEntry | null)[]) {
  const add = entries.filter((e): e is LogEntry => e !== null);
  if (!add.length) return;
  // Read-modify-write is fine here: logs are diagnostics, not state.
  const p = await prisma.payment.findUnique({ where: { id: paymentId }, select: { raw: true } });
  if (!p) return;
  await prisma.payment.update({
    where: { id: paymentId },
    data: { raw: [...toJsonArray(p.raw), ...(add as unknown as Prisma.InputJsonValue[])] },
  });
}

/** New Payment row for the order's next attempt (supersedes any open attempt). */
export async function createAttempt(tx: Tx, orderId: string, method: PaymentMethod, amountCents: number) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { orderNumber: true, _count: { select: { payments: true } } },
  });
  await tx.payment.updateMany({
    where: { orderId, status: { in: [...OPEN_ATTEMPT] } },
    data: { status: "CANCELLED", failReason: "Superseded by a new attempt" },
  });
  const attempt = order._count.payments + 1;
  return tx.payment.create({
    data: {
      orderId,
      method,
      attempt,
      reference: paymentReference(order.orderNumber, attempt),
      amountCents,
      status: method === "COD" ? "PENDING" : "INITIATED",
    },
    select: { id: true, reference: true, attempt: true, amountCents: true },
  });
}

// ───────────────────────────── outcomes ─────────────────────────────

type GatewayIds = { trxId?: string | null; valId?: string | null; bankTranId?: string | null };

/** Payment confirmed by the gateway (after server-side verification). Idempotent. */
export async function markPaid(reference: string, ids: GatewayIds, tag: string, log: LogEntry[] = []): Promise<CallbackResult> {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { reference },
      select: { id: true, orderId: true, status: true, method: true, order: { select: { paymentStatus: true } } },
    });
    if (!payment) return { outcome: "invalid", orderId: null, reason: "Unknown transaction" } as CallbackResult;

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { not: "SUCCEEDED" } },
      data: { status: "SUCCEEDED", completedAt: new Date(), failReason: null, ...ids },
    });
    if (claimed.count !== 1) return { outcome: "noop", orderId: payment.orderId, paid: true } as CallbackResult;

    if (payment.order.paymentStatus === "PAID") {
      // A second attempt succeeded on an already-paid order: keep it, flag for refund.
      log.push(paymentWarn(tag, "duplicate-payment", { orderId: payment.orderId, reference, action: "refund" }));
      return { outcome: "noop", orderId: payment.orderId, paid: true } as CallbackResult;
    }

    const stockNote = await commitStock(tx, payment.orderId, tag);
    if (stockNote) log.push(stockNote);
    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: "PROCESSING", paymentStatus: "PAID", paidAt: new Date(), expiresAt: null },
    });
    await recordStatus(tx, payment.orderId, "PROCESSING", `Paid via ${paymentMethodMeta[payment.method].label}`);
    await clearOrderedCart(tx, payment.orderId);
    return { outcome: "paid", orderId: payment.orderId, paid: true } as CallbackResult;
  });

  const p = await prisma.payment.findUnique({ where: { reference }, select: { id: true } });
  if (p) await appendPaymentLog(p.id, ...log, paymentLog(tag, `mark-paid:${result.outcome}`, { reference, ...ids }));
  if (result.outcome === "paid" && result.orderId) queueConfirmationEmail(result.orderId);
  return result;
}

/** Customer failed / cancelled at the gateway. Idempotent; never touches a paid order. */
export async function markFailed(
  reference: string,
  outcome: "failed" | "cancelled",
  reason: string,
  tag = "[payments]",
  log: LogEntry[] = [],
): Promise<CallbackResult> {
  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { reference },
      select: { id: true, orderId: true, order: { select: { paymentStatus: true } } },
    });
    if (!payment) return { outcome: "invalid", orderId: null, reason: "Unknown transaction" } as CallbackResult;

    const claimed = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: [...OPEN_ATTEMPT] } },
      data: { status: outcome === "cancelled" ? "CANCELLED" : "FAILED", failReason: reason, completedAt: new Date() },
    });
    const paid = payment.order.paymentStatus === "PAID";
    if (claimed.count !== 1) return { outcome: "noop", orderId: payment.orderId, paid } as CallbackResult;

    const order = await tx.order.updateMany({
      where: { id: payment.orderId, paymentStatus: "UNPAID", status: "PENDING_PAYMENT" },
      data: { status: outcome === "cancelled" ? "CANCELLED" : "FAILED", expiresAt: null },
    });
    if (order.count === 1) {
      await releaseStock(tx, payment.orderId);
      await recordStatus(tx, payment.orderId, outcome === "cancelled" ? "CANCELLED" : "FAILED", reason);
    }
    return { outcome, orderId: payment.orderId, paid, reason } as CallbackResult;
  });

  const p = await prisma.payment.findUnique({ where: { reference }, select: { id: true } });
  if (p) await appendPaymentLog(p.id, ...log, paymentLog(tag, `mark-${outcome}:${result.outcome}`, { reference, reason }));
  return result;
}

/** Record the gateway's own id on the attempt (bKash paymentID, SSLCommerz sessionkey). */
export async function recordGatewaySession(
  attemptId: string,
  data: { paymentId?: string; sessionKey?: string },
  ...log: LogEntry[]
) {
  await prisma.payment.update({ where: { id: attemptId }, data: { ...data, status: "PENDING" } });
  await appendPaymentLog(attemptId, ...log);
}

// ───────────────────────────── expiry ─────────────────────────────

/**
 * PENDING_PAYMENT orders past their deadline → EXPIRED, stock released.
 * COD orders are never PENDING_PAYMENT, so their reservation is untouched.
 */
export async function expireStale(opts: { orderId?: string; limit?: number } = {}): Promise<number> {
  const now = new Date();
  const stale = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: now }, ...(opts.orderId ? { id: opts.orderId } : {}) },
    select: { id: true },
    take: opts.limit ?? 100,
  });
  let expired = 0;
  for (const { id } of stale) {
    const done = await prisma.$transaction(async (tx) => {
      const n = await tx.order.updateMany({
        where: { id, status: "PENDING_PAYMENT", paymentStatus: "UNPAID" },
        data: { status: "EXPIRED", expiresAt: null },
      });
      if (n.count !== 1) return false;
      await tx.payment.updateMany({
        where: { orderId: id, status: { in: [...OPEN_ATTEMPT] } },
        data: { status: "EXPIRED", failReason: `Unpaid after ${PENDING_PAYMENT_TTL_MIN} minutes`, completedAt: now },
      });
      await releaseStock(tx, id);
      await recordStatus(tx, id, "EXPIRED", `Unpaid after ${PENDING_PAYMENT_TTL_MIN} minutes`);
      return true;
    });
    if (done) {
      expired++;
      paymentLog("[payments]", "expired", { orderId: id });
    }
  }
  return expired;
}

export const pendingPaymentDeadline = () => new Date(Date.now() + PENDING_PAYMENT_TTL_MIN * 60_000);

// ───────────────────────────── email ─────────────────────────────

/** Order confirmation, after the response (lib/mail.ts logs it until a provider exists). */
export function queueConfirmationEmail(orderId: string) {
  after(async () => {
    try {
      const o = await prisma.order.findUnique({
        where: { id: orderId },
        select: { email: true, orderNumber: true, totalCents: true, paymentMethod: true, paymentStatus: true },
      });
      if (!o) return;
      const paid = o.paymentStatus === "PAID";
      await sendMail({
        to: o.email,
        subject: `Your Ecomfy order ${o.orderNumber}`,
        text: paid
          ? `Thanks! We received ${formatPrice(o.totalCents)} for order ${o.orderNumber}.`
          : `Thanks! Order ${o.orderNumber} is placed. Pay ${formatPrice(o.totalCents)} in cash on delivery.`,
      });
    } catch (err) {
      console.warn("[mail] confirmation failed", String(err));
    }
  });
}
