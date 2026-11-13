const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Money is stored as integer cents everywhere. */
export function formatPrice(cents: number): string {
  return usd.format(cents / 100);
}

/** "64% Off" badge: percentage saved versus the compare-at price. */
export function discountPercent(priceCents: number, compareAtCents?: number | null): number {
  if (!compareAtCents || compareAtCents <= priceCents) return 0;
  return Math.round(((compareAtCents - priceCents) / compareAtCents) * 100);
}

const usdWhole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Whole-dollar label for ranges (Shop price filter "Price: $5 — $61"). */
export function formatPriceWhole(cents: number): string {
  return usdWhole.format(cents / 100);
}
