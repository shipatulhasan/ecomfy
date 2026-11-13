import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import type { StoreSettings } from "@/lib/checkout/settings";
import type { AddressInput } from "@/lib/validations/address";

/**
 * One implementation per payment method (lib/payments/{bkash,sslcommerz,cod}.ts),
 * registered in lib/payments/registry.ts. Providers only talk to their gateway and
 * report outcomes; order / stock / cart transitions live in lib/payments/service.ts.
 */

/** What a provider needs to start a payment. Amounts are BDT poisha. */
export type PaymentOrder = {
  id: string;
  orderNumber: string;
  totalCents: number;
  email: string;
  phone: string;
  billing: AddressInput;
  shipping: AddressInput;
  items: { productName: string; quantity: number }[];
};

/** The Payment row for this attempt (reference = gateway transaction id). */
export type PaymentAttemptRef = { id: string; reference: string; attempt: number; amountCents: number };

export type StartResult = { redirectUrl: string } | { done: true };

export type CallbackOutcome = "paid" | "failed" | "cancelled" | "pending" | "noop" | "invalid";

export type CallbackResult = {
  outcome: CallbackOutcome;
  /** null when the callback didn't match any order. */
  orderId: string | null;
  /** Final state of the order after a noop (duplicate callback), to redirect correctly. */
  paid?: boolean;
  reason?: string;
};

export interface PaymentProvider {
  method: PaymentMethod;
  /** Log tag: "[bkash]", "[sslcz]", "[cod]". */
  tag: string;
  isEnabled(settings: StoreSettings): boolean;
  start(order: PaymentOrder, attempt: PaymentAttemptRef): Promise<StartResult>;
}
