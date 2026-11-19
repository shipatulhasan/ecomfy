"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-guards";
import { resolveCartOwner, findCartId } from "@/lib/cart/owner";
import { canAccessOrder, rememberOrder } from "@/lib/checkout/order-access";
import { codProblem, computeCheckoutQuote, type CheckoutQuote } from "@/lib/checkout/pricing";
import type { StoreSettings } from "@/lib/checkout/settings";
import { orderNumberFor, paymentMethodMeta, PLACE_ORDER_LIMIT } from "@/lib/config/checkout";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { toDisplayCents } from "@/lib/money";
import { invalidateOrderAggregates } from "@/lib/orders/cache";
import { recordStatus } from "@/lib/orders/history";
import { startPayment } from "@/lib/payments/service";
import {
  clearOrderedCart,
  createAttempt,
  pendingPaymentDeadline,
  queueConfirmationEmail,
  reserveStock,
  StockError,
} from "@/lib/payments/state";
import { getCart } from "@/lib/queries/cart";
import { canTransition } from "@/lib/orders/transitions";
import { getStoreSettings } from "@/lib/queries/settings";
import { clientIp, consume } from "@/lib/rate-limit";
import { checkoutSchema, quoteSchema, retryPaymentSchema } from "@/lib/validations/checkout";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Checkout. Every amount is recomputed here from the DB cart + settings; the
 * client never sends totals. Order creation is one transaction (order, item
 * price snapshots, address snapshots, stock reservation, first payment attempt)
 * keyed by the form's idempotency key, so a double submit makes one order.
 */

export type PlaceOrderResult =
  /** Leave the site for the gateway. */
  | { kind: "gateway"; url: string }
  /** Navigate within the site (COD success, duplicate submit, failed gateway start). */
  | { kind: "navigate"; href: string; message?: string; cleared?: boolean }
  /** Cart changed under us (stock): back to /cart with the message. */
  | { kind: "cart"; href: string; message: string };

const STOCK_HREF = "/cart?notice=stock";

// ───────────────────────────── quote ─────────────────────────────

/** Live totals when the district or payment method changes. */
export async function quoteCheckout(input: unknown): Promise<ActionResult<CheckoutQuote>> {
  return runAction(quoteSchema, input, async ({ district, paymentMethod }) => {
    const [cart, settings] = await Promise.all([getCart(), getStoreSettings()]);
    return computeCheckoutQuote(cart, settings, district, paymentMethod);
  });
}

// ───────────────────────────── shared checks ─────────────────────────────

async function limitPlacement(userId: string | undefined) {
  const ip = await clientIp();
  const r = await consume(`place-order:${userId ?? ip}`, PLACE_ORDER_LIMIT);
  if (!r.allowed) {
    const minutes = Math.ceil((r.retryAfter ?? 60) / 60);
    throw new ActionError(`Too many order attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
  }
  return ip;
}

function assertMethod(settings: StoreSettings, method: PaymentMethod, reason: string | null, enabled: boolean) {
  if (method === "BKASH" && !settings.bkashEnabled) throw new ActionError("bKash is unavailable right now.");
  if (method === "SSLCOMMERZ" && !settings.sslcommerzEnabled) {
    throw new ActionError("Card and online banking payments are unavailable right now.");
  }
  if (!enabled) throw new ActionError(reason ?? "This payment method isn't available for this order.");
}

/** COD abuse protection: rate-limit per phone, flag (never block) phones with cancelled COD orders. */
async function codPhoneCheck(settings: StoreSettings, phone: string, excludeOrderId?: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recent, cancelled] = await Promise.all([
    prisma.order.count({
      where: {
        phone,
        paymentMethod: "COD",
        createdAt: { gte: since },
        status: { notIn: ["FAILED", "EXPIRED"] },
        ...(excludeOrderId ? { id: { not: excludeOrderId } } : {}),
      },
    }),
    prisma.order.count({ where: { phone, paymentMethod: "COD", status: "CANCELLED" } }),
  ]);
  if (recent >= settings.codMaxPerPhonePerDay) {
    throw new ActionError(
      "This phone number has reached today's Cash on Delivery limit. Please pay with bKash or card, or try again tomorrow.",
    );
  }
  return cancelled > 0
    ? { codFlagged: true, codFlagReason: `${cancelled} previously cancelled COD order${cancelled === 1 ? "" : "s"}` }
    : { codFlagged: false, codFlagReason: null };
}

const successHref = (orderId: string) => `/checkout/success?id=${encodeURIComponent(orderId)}`;
const failedHref = (orderId: string) => `/checkout/failed?id=${encodeURIComponent(orderId)}&reason=unavailable`;

/** A repeated submit (same idempotency key): point at the order that already exists. */
function existingHandoff(order: { id: string }): PlaceOrderResult {
  return { kind: "navigate", href: successHref(order.id) };
}

async function handOff(
  orderId: string,
  method: PaymentMethod,
  attempt: { id: string; reference: string; attempt: number; amountCents: number },
): Promise<PlaceOrderResult> {
  if (method === "COD") {
    await startPayment(orderId, attempt, method);
    queueConfirmationEmail(orderId);
    refresh(); // header cart, tab badge
    return { kind: "navigate", href: successHref(orderId), cleared: true };
  }
  const started = await startPayment(orderId, attempt, method);
  if ("error" in started) return { kind: "navigate", href: failedHref(orderId), message: started.error };
  if ("redirectUrl" in started) return { kind: "gateway", url: started.redirectUrl };
  return { kind: "navigate", href: successHref(orderId) };
}

// ───────────────────────────── place order ─────────────────────────────

export async function placeOrder(input: unknown): Promise<ActionResult<PlaceOrderResult>> {
  return runAction(checkoutSchema, input, async (data) => {
    const user = await getCurrentUser();

    // Double submit: the first request already made this order.
    const existing = await prisma.order.findUnique({ where: { idempotencyKey: data.idempotencyKey }, select: { id: true } });
    if (existing) return existingHandoff(existing);

    const ip = await limitPlacement(user?.id);

    const owner = await resolveCartOwner();
    const [cart, settings, cartId] = await Promise.all([getCart(owner), getStoreSettings(), findCartId(owner)]);
    if (cart.lines.length === 0 || !cartId) redirect("/cart");
    if (cart.hasIssues) {
      return { kind: "cart", href: STOCK_HREF, message: "Some items in your cart changed. Please review your cart." } as const;
    }

    const shipTo = data.shipToDifferentAddress && data.shipping ? data.shipping : data.billing;
    const method = data.paymentMethod;
    const quote = computeCheckoutQuote(cart, settings, shipTo.district, method);
    assertMethod(settings, method, quote.methods[method].reason, quote.methods[method].enabled);
    if (quote.shippingCents === null) throw new ActionError("Choose a delivery district.");

    const phone = data.billing.phone;
    const flags = method === "COD" ? await codPhoneCheck(settings, phone) : { codFlagged: false, codFlagReason: null };
    const rate = settings.usdToBdtRate;

    let created: { orderId: string; attempt: Awaited<ReturnType<typeof createAttempt>> };
    try {
      created = await prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            // Placeholder until the autoincrement number exists (same transaction).
            orderNumber: `tmp-${data.idempotencyKey}`,
            idempotencyKey: data.idempotencyKey,
            userId: user?.id ?? null,
            cartId,
            email: data.billing.email,
            phone,
            billingAddress: data.billing,
            shippingAddress: shipTo,
            district: shipTo.district,
            notes: data.notes ?? null,
            status: method === "COD" ? "PENDING_CONFIRMATION" : "PENDING_PAYMENT",
            paymentStatus: "UNPAID",
            paymentMethod: method,
            subtotalCents: quote.subtotalCents,
            discountCents: quote.discountCents,
            shippingCents: quote.shippingCents ?? 0,
            codFeeCents: quote.codFeeCents,
            totalCents: quote.totalCents,
            currency: "BDT",
            displayCurrency: data.displayCurrency,
            fxRate: data.displayCurrency === "USD" ? rate : 1,
            displayTotalCents: toDisplayCents(quote.totalCents, data.displayCurrency, rate),
            shippingZoneName: quote.zone?.name ?? null,
            deliveryEstimate: quote.zone?.etaText ?? null,
            // reserveStock below flips this to RESERVED (and counts the coupon use).
            stockState: "RELEASED",
            ...flags,
            placedIp: ip,
            expiresAt: method === "COD" ? null : pendingPaymentDeadline(settings.pendingPaymentTtlMin),
            couponId: quote.couponCode ? await couponId(tx, quote.couponCode) : null,
            couponCode: quote.couponCode,
            items: {
              create: cart.lines.map((l) => ({
                variantId: l.variantId,
                productName: l.name,
                variantName: l.variantName,
                imageUrl: l.image?.url ?? null,
                unitPriceCents: l.unitCents,
                quantity: l.quantity,
                subtotalCents: l.lineCents,
              })),
            },
          },
          select: { id: true, number: true },
        });
        await tx.order.update({ where: { id: order.id }, data: { orderNumber: orderNumberFor(order.number) } });
        await recordStatus(
          tx,
          order.id,
          method === "COD" ? "PENDING_CONFIRMATION" : "PENDING_PAYMENT",
          method === "COD" ? "Placed with Cash on Delivery" : "Placed, waiting for payment",
          "customer",
        );
        await reserveStock(tx, order.id);
        const attempt = await createAttempt(tx, order.id, method, quote.totalCents);
        if (method === "COD") await clearOrderedCart(tx, order.id);
        return { orderId: order.id, attempt };
      });
    } catch (err) {
      if (err instanceof StockError) return { kind: "cart", href: STOCK_HREF, message: err.message } as const;
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const dup = await prisma.order.findUnique({ where: { idempotencyKey: data.idempotencyKey }, select: { id: true } });
        if (dup) return existingHandoff(dup);
      }
      throw err;
    }

    await rememberOrder(created.orderId);
    invalidateOrderAggregates();
    if (user && data.saveAddress) await saveDefaultAddress(user.id, data.billing);
    return handOff(created.orderId, method, created.attempt);
  });
}

async function couponId(tx: Prisma.TransactionClient, code: string) {
  const c = await tx.coupon.findUnique({ where: { code }, select: { id: true } });
  return c?.id ?? null;
}

async function saveDefaultAddress(userId: string, a: import("@/lib/validations/address").AddressInput) {
  const fields = {
    firstName: a.firstName,
    lastName: a.lastName,
    companyName: a.companyName ?? null,
    street: a.street,
    city: a.city,
    district: a.district,
    country: "Bangladesh",
    zip: a.zip,
    email: a.email,
    phone: a.phone,
  };
  const current = await prisma.address.findFirst({
    where: { userId, kind: "BILLING", isDefault: true },
    select: { id: true },
  });
  if (current) await prisma.address.update({ where: { id: current.id }, data: fields });
  else await prisma.address.create({ data: { userId, kind: "BILLING", isDefault: true, ...fields } });
}

// ───────────────────────────── retry ─────────────────────────────

/**
 * /checkout/failed: "Try again" or "Change method" on the SAME order. Stock is
 * reserved again (it was released when the attempt failed), totals are
 * recomputed for the method (COD fee / rules), and a new Payment attempt starts.
 */
export async function retryPayment(input: unknown): Promise<ActionResult<PlaceOrderResult>> {
  return runAction(retryPaymentSchema, input, async ({ orderId, paymentMethod: method }) => {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        status: true,
        paymentStatus: true,
        cancelledAt: true,
        phone: true,
        district: true,
        subtotalCents: true,
        discountCents: true,
        shippingCents: true,
        displayCurrency: true,
      },
    });
    if (!order || !(await canAccessOrder(order))) throw new ActionError("We couldn't find that order.");
    if (order.paymentStatus === "PAID") return { kind: "navigate", href: successHref(order.id) } as const;
    const retryable = ["FAILED", "CANCELLED", "EXPIRED", "PENDING_PAYMENT"] as const;
    const target = method === "COD" ? "PENDING_CONFIRMATION" : "PENDING_PAYMENT";
    // Staff / customer cancellations are final (cancelledAt); gateway cancels can be retried.
    if (
      !(retryable as readonly string[]).includes(order.status) ||
      order.cancelledAt !== null ||
      !canTransition(order.status, target, { actor: "customer" })
    ) {
      return { kind: "navigate", href: successHref(order.id) } as const;
    }

    const user = await getCurrentUser();
    await limitPlacement(user?.id);
    const settings = await getStoreSettings();

    const payable = Math.max(0, order.subtotalCents - order.discountCents) + order.shippingCents;
    const cod = codProblem(settings, order.district, payable);
    assertMethod(settings, method, cod, method === "COD" ? cod === null : true);
    const codFeeCents = method === "COD" ? settings.codFeeCents : 0;
    const totalCents = payable + codFeeCents;
    const flags = method === "COD" ? await codPhoneCheck(settings, order.phone, order.id) : { codFlagged: false, codFlagReason: null };
    const rate = settings.usdToBdtRate;
    const display = order.displayCurrency === "USD" ? "USD" : "BDT";

    let attempt: Awaited<ReturnType<typeof createAttempt>>;
    try {
      attempt = await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: order.id, paymentStatus: "UNPAID", cancelledAt: null, status: { in: [...retryable] } },
          data: {
            version: { increment: 1 },
            paymentMethod: method,
            codFeeCents,
            totalCents,
            fxRate: display === "USD" ? rate : 1,
            displayTotalCents: toDisplayCents(totalCents, display, rate),
            status: target,
            expiresAt: method === "COD" ? null : pendingPaymentDeadline(settings.pendingPaymentTtlMin),
            ...flags,
          },
        });
        if (claimed.count !== 1) throw new ActionError("This order can't be paid again. Please check its status.");
        await recordStatus(
          tx,
          order.id,
          target,
          `Payment retried with ${paymentMethodMeta[method].label}`,
          "customer",
        );
        await reserveStock(tx, order.id);
        const a = await createAttempt(tx, order.id, method, totalCents);
        if (method === "COD") await clearOrderedCart(tx, order.id);
        return a;
      });
    } catch (err) {
      if (err instanceof StockError) return { kind: "cart", href: STOCK_HREF, message: err.message } as const;
      throw err;
    }
    return handOff(order.id, method, attempt);
  });
}
