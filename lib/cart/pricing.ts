/**
 * Cart shapes and price maths. Pure (no server-only): the server computes the
 * authoritative cart with it, and the client store reuses it for optimistic
 * totals so the numbers don't jump when the server answer lands.
 */
import { SHIPPING_CENTS } from "@/lib/config/cart";
import { MAX_CART_QTY } from "@/lib/config/product";
import { formatPrice } from "@/lib/money";

export type LineIssue = { kind: "out" } | { kind: "low"; available: number };

export type CartLine = {
  /** CartItem id. Optimistic lines use `tmp:<variantId>` until the server answers. */
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string;
  image: { url: string; alt: string } | null;
  unitCents: number;
  compareAtCents: number | null;
  quantity: number;
  stock: number;
  lineCents: number;
  issue: LineIssue | null;
};

export type CouponRule = {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  minSubtotalCents: number | null;
};

/** The coupon attached to a cart; `error` is set while it doesn't apply (discount 0). */
export type CartCoupon = CouponRule & { error: string | null };

export type CartTotals = {
  /** Units (sum of quantities). */
  count: number;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
};

export type CartView = {
  lines: CartLine[];
  coupon: CartCoupon | null;
  totals: CartTotals;
  /** Any line out of stock or above stock: checkout is disabled. */
  hasIssues: boolean;
};

export const EMPTY_CART: CartView = {
  lines: [],
  coupon: null,
  totals: { count: 0, subtotalCents: 0, discountCents: 0, shippingCents: 0, totalCents: 0 },
  hasIssues: false,
};

export const maxLineQuantity = (stock: number) => Math.max(0, Math.min(stock, MAX_CART_QTY));

export function lineIssue(quantity: number, stock: number, available = true): LineIssue | null {
  if (!available || stock <= 0) return { kind: "out" };
  if (quantity > stock) return { kind: "low", available: stock };
  return null;
}

/**
 * Minimum-spend message, or null when the coupon's minimum is met. Client callers
 * pass `useCurrency().format` so the shortfall shows in the visitor's currency.
 */
export function couponMinimumProblem(
  coupon: CouponRule,
  subtotalCents: number,
  format: (poisha: number) => string = formatPrice,
): string | null {
  if (coupon.minSubtotalCents && subtotalCents < coupon.minSubtotalCents) {
    return `Spend ${format(coupon.minSubtotalCents - subtotalCents)} more to use ${coupon.code}`;
  }
  return null;
}

/** Stock a cart / checkout may still take: on hand minus what open orders hold. */
export const availableStock = (v: { stock: number; reserved: number }) => Math.max(0, v.stock - v.reserved);

export function couponDiscount(coupon: CouponRule, subtotalCents: number): number {
  if (subtotalCents <= 0) return 0;
  const raw = coupon.type === "PERCENT" ? Math.round((subtotalCents * coupon.value) / 100) : coupon.value;
  return Math.min(raw, subtotalCents);
}

/**
 * Totals from lines + coupon. A coupon with a stored `error` (expired, used up)
 * gives no discount. The minimum spend is re-checked here so an optimistic
 * quantity change shows the right total at once.
 */
export function computeTotals(lines: CartLine[], coupon: CartCoupon | null): CartTotals {
  let count = 0;
  let subtotalCents = 0;
  for (const l of lines) {
    count += l.quantity;
    subtotalCents += l.unitCents * l.quantity;
  }
  const applies = coupon && !coupon.error && !couponMinimumProblem(coupon, subtotalCents);
  const discountCents = applies ? couponDiscount(coupon, subtotalCents) : 0;
  const shippingCents = count > 0 ? SHIPPING_CENTS : 0;
  return {
    count,
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents: Math.max(0, subtotalCents - discountCents + shippingCents),
  };
}

/** Rebuild derived fields (line totals, issues, coupon minimum, totals) after lines change. */
export function buildCartView(lines: CartLine[], coupon: CartCoupon | null): CartView {
  const withLines = lines.map((l) => {
    const issue = l.issue?.kind === "out" ? l.issue : lineIssue(l.quantity, l.stock);
    return { ...l, lineCents: l.unitCents * l.quantity, issue };
  });
  return {
    lines: withLines,
    coupon,
    totals: computeTotals(withLines, coupon),
    hasIssues: withLines.some((l) => l.issue !== null),
  };
}
