/**
 * Checkout totals: cart totals + shipping zone + Cash on Delivery fee and rules.
 * Pure and shared: the server computes the authoritative numbers with it for the
 * live quote and again inside placeOrder (never trusting client totals); the
 * checkout form only displays what the server returned.
 */
import type { CartView } from "@/lib/cart/pricing";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { formatPrice } from "@/lib/money";
import { zoneFor, type StoreSettings } from "./settings";

export type MethodAvailability = { enabled: boolean; reason: string | null };

export type CheckoutQuote = {
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  /** null until a district is chosen. */
  shippingCents: number | null;
  zone: { name: string; etaText: string } | null;
  codFeeCents: number;
  totalCents: number;
  district: string | null;
  paymentMethod: PaymentMethod;
  methods: Record<PaymentMethod, MethodAvailability>;
};

/** Why COD can't be used for this order, or null. */
export function codProblem(settings: StoreSettings, district: string | null, payableCents: number): string | null {
  if (!settings.codEnabled) return "Cash on Delivery is turned off right now.";
  if (settings.codMaxOrderCents != null && payableCents > settings.codMaxOrderCents) {
    return `Cash on Delivery is available for orders up to ${formatPrice(settings.codMaxOrderCents)}.`;
  }
  if (district && settings.codAllowedDistricts.length > 0 && !settings.codAllowedDistricts.includes(district)) {
    return `Cash on Delivery isn't available in ${district}.`;
  }
  return null;
}

export function methodAvailability(
  settings: StoreSettings,
  district: string | null,
  payableCents: number,
): Record<PaymentMethod, MethodAvailability> {
  const cod = codProblem(settings, district, payableCents);
  return {
    BKASH: { enabled: settings.bkashEnabled, reason: settings.bkashEnabled ? null : "bKash is unavailable right now." },
    SSLCOMMERZ: {
      enabled: settings.sslcommerzEnabled,
      reason: settings.sslcommerzEnabled ? null : "Card and online banking payments are unavailable right now.",
    },
    COD: { enabled: cod === null, reason: cod },
  };
}

export function computeCheckoutQuote(
  cart: CartView,
  settings: StoreSettings,
  district: string | null,
  paymentMethod: PaymentMethod,
): CheckoutQuote {
  const { subtotalCents, discountCents } = cart.totals;
  const zone = zoneFor(settings, district);
  const shippingCents = zone ? zone.rateCents : null;
  // The COD limit applies to what the courier collects before the COD fee.
  const payable = Math.max(0, subtotalCents - discountCents) + (shippingCents ?? 0);
  const methods = methodAvailability(settings, district, payable);
  const codFeeCents = paymentMethod === "COD" && methods.COD.enabled ? settings.codFeeCents : 0;
  return {
    subtotalCents,
    discountCents,
    couponCode: discountCents > 0 && cart.coupon ? cart.coupon.code : null,
    shippingCents,
    zone: zone ? { name: zone.name, etaText: zone.etaText } : null,
    codFeeCents,
    totalCents: payable + codFeeCents,
    district,
    paymentMethod,
    methods,
  };
}

/**
 * Quote for paying an existing order again (/checkout/failed "Try again", account
 * Order Details "Pay now"): the order's own totals, methods available for it.
 */
export function retryQuote(
  order: {
    subtotalCents: number;
    discountCents: number;
    couponCode: string | null;
    shippingCents: number;
    codFeeCents: number;
    totalCents: number;
    district: string;
    paymentMethod: PaymentMethod;
  },
  settings: StoreSettings,
): CheckoutQuote {
  return {
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    couponCode: order.couponCode,
    shippingCents: order.shippingCents,
    zone: null,
    codFeeCents: order.codFeeCents,
    totalCents: order.totalCents,
    district: order.district,
    paymentMethod: order.paymentMethod,
    methods: methodAvailability(settings, order.district, order.totalCents - order.codFeeCents),
  };
}
