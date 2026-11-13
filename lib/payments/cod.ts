import "server-only";
import { paymentLog } from "./log";
import { appendPaymentLog } from "./state";
import type { PaymentProvider } from "./types";

/**
 * Cash on Delivery: no gateway. placeOrder already created the order as
 * PENDING_CONFIRMATION / UNPAID with stock reserved (the pending-payment expiry
 * job never touches it). An admin confirms → PROCESSING and marks it paid on
 * delivery → PAID (admin UI comes later). Rules (on/off, fee, max amount,
 * districts, per-phone limit) are enforced in placeOrder / retryPayment.
 */
export const cod: PaymentProvider = {
  method: "COD",
  tag: "[cod]",
  isEnabled: (s) => s.codEnabled,
  async start(order, attempt) {
    await appendPaymentLog(attempt.id, paymentLog("[cod]", "placed", { orderNumber: order.orderNumber, amount: attempt.amountCents }));
    return { done: true };
  },
};
