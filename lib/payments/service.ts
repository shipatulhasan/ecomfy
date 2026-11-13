import "server-only";
import { prisma } from "@/lib/db";
import { paymentMethodMeta } from "@/lib/config/checkout";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { addressSchema } from "@/lib/validations/address";
import { paymentWarn } from "./log";
import { getProvider } from "./registry";
import { appendPaymentLog, markFailed } from "./state";
import type { PaymentAttemptRef, PaymentOrder, StartResult } from "./types";

/** Starts a payment with the order's provider. State transitions live in ./state.ts. */

async function loadPaymentOrder(orderId: string): Promise<PaymentOrder> {
  const o = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      totalCents: true,
      email: true,
      phone: true,
      billingAddress: true,
      shippingAddress: true,
      items: { select: { productName: true, quantity: true } },
    },
  });
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    totalCents: o.totalCents,
    email: o.email,
    phone: o.phone,
    billing: addressSchema.parse(o.billingAddress),
    shipping: addressSchema.parse(o.shippingAddress),
    items: o.items,
  };
}

/**
 * Hand the order's current attempt to its provider. A gateway that can't start
 * (down, misconfigured) fails the attempt and releases stock, so the customer
 * lands on /checkout/failed with "Try again" / "Change method".
 */
export async function startPayment(
  orderId: string,
  attempt: PaymentAttemptRef,
  method: PaymentMethod,
): Promise<StartResult | { error: string }> {
  const provider = getProvider(method);
  try {
    const order = await loadPaymentOrder(orderId);
    return await provider.start(order, attempt);
  } catch (err) {
    const entry = paymentWarn(provider.tag, "start-failed", { orderId, reference: attempt.reference, error: String(err) });
    await appendPaymentLog(attempt.id, entry);
    await markFailed(attempt.reference, "failed", "Couldn't reach the payment gateway");
    return { error: `${paymentMethodMeta[method].label} is unavailable right now. Please try again or choose another method.` };
  }
}

