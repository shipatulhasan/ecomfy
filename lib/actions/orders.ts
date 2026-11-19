"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth-guards";
import { addVariantToCart } from "@/lib/cart/mutations";
import { resolveCartOwner } from "@/lib/cart/owner";
import type { CartView } from "@/lib/cart/pricing";
import { prisma } from "@/lib/db";
import { invalidateOrderAggregates } from "@/lib/orders/cache";
import { queueOrderEmail } from "@/lib/orders/emails";
import { recordStatus } from "@/lib/orders/history";
import { CANCELLABLE_STATUSES } from "@/lib/orders/status";
import { canTransition } from "@/lib/orders/transitions";
import { releaseStock } from "@/lib/payments/state";
import { getCart } from "@/lib/queries/cart";
import { consume, type Rule } from "@/lib/rate-limit";
import { orderActionSchema } from "@/lib/validations/orders";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Customer actions on their own orders (account Order Details). Every query has
 * `userId` in its WHERE, so another customer's order number behaves exactly like a
 * missing one. "Pay now" is `retryPayment` (lib/actions/checkout.ts), which checks
 * ownership and rate-limits itself.
 */

const CANCEL_LIMIT: Rule = { window: 10 * 60, max: 5 };
const REORDER_LIMIT: Rule = { window: 10 * 60, max: 20 };

async function limit(key: string, rule: Rule) {
  const r = await consume(key, rule);
  if (!r.allowed) {
    const minutes = Math.ceil((r.retryAfter ?? 60) / 60);
    throw new ActionError(`Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
}

const NOT_FOUND = "We couldn't find that order.";

/**
 * Cancel an order that hasn't been paid or confirmed yet: releases the stock (and
 * the coupon use), closes open payment attempts and writes the status history.
 */
export async function cancelOrder(input: unknown): Promise<ActionResult<{ number: number }>> {
  return runAction(orderActionSchema, input, async ({ orderNumber }) => {
    const user = await requireUser();
    await limit(`order-cancel:${user.id}`, CANCEL_LIMIT);

    const order = await prisma.order.findFirst({
      where: { number: orderNumber, userId: user.id },
      select: { id: true, status: true, version: true },
    });
    if (!order) throw new ActionError(NOT_FOUND);
    if (!canTransition(order.status, "CANCELLED", { actor: "customer" })) {
      throw new ActionError("This order can no longer be cancelled.");
    }

    await prisma.$transaction(async (tx) => {
      // Conditional: a gateway callback that paid it (or staff that confirmed it) a moment ago wins.
      const claimed = await tx.order.updateMany({
        where: {
          id: order.id,
          userId: user.id,
          version: order.version,
          paymentStatus: "UNPAID",
          status: { in: [...CANCELLABLE_STATUSES] },
        },
        data: {
          status: "CANCELLED",
          expiresAt: null,
          cancelledAt: new Date(),
          cancelReason: "Cancelled by customer",
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) throw new ActionError("This order can no longer be cancelled.");
      await tx.payment.updateMany({
        where: { orderId: order.id, type: { not: "REFUND" }, status: { in: ["INITIATED", "PENDING"] } },
        data: { status: "CANCELLED", failReason: "Order cancelled by customer", completedAt: new Date() },
      });
      await releaseStock(tx, order.id);
      await recordStatus(tx, order.id, "CANCELLED", "Cancelled by customer", "customer");
    });

    invalidateOrderAggregates();
    queueOrderEmail(order.id, "cancelled");
    refresh();
    return { number: orderNumber };
  });
}

export type ReorderResult = { cart: CartView; added: number; skipped: { name: string; reason: string }[] };

/** "Order again": add every line that's still available; report the rest. */
export async function reorder(input: unknown): Promise<ActionResult<ReorderResult>> {
  return runAction(orderActionSchema, input, async ({ orderNumber }) => {
    const user = await requireUser();
    await limit(`order-again:${user.id}`, REORDER_LIMIT);

    const order = await prisma.order.findFirst({
      where: { number: orderNumber, userId: user.id },
      select: { items: { orderBy: { id: "asc" }, select: { variantId: true, quantity: true, productName: true } } },
    });
    if (!order) throw new ActionError(NOT_FOUND);

    let added = 0;
    const skipped: ReorderResult["skipped"] = [];
    for (const item of order.items) {
      if (!item.variantId) {
        skipped.push({ name: item.productName, reason: "This product is no longer available." });
        continue;
      }
      try {
        await addVariantToCart(item.variantId, item.quantity);
        added++;
      } catch (err) {
        if (!(err instanceof ActionError)) throw err;
        skipped.push({ name: item.productName, reason: err.message });
      }
    }
    if (added === 0) throw new ActionError("None of these items are available right now.");

    // No refresh(): nothing on the order page is server-rendered from the cart; the
    // client cart store adopts `cart` and opens the mini cart. Cart pages are dynamic.
    return { cart: await getCart(await resolveCartOwner()), added, skipped };
  });
}
