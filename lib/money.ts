/**
 * Money. Amounts are integer **poisha** (1/100 BDT) everywhere: in the DB, in
 * code and at the gateways. Fields keep the historical `*Cents` name.
 *
 * BDT is the base and charge currency. USD is display-only: the topbar switcher
 * (components/shared/currency-switcher.tsx) sets `html[data-currency]`, and
 * <Money> (components/shared/money.tsx) renders both values so CSS shows the
 * right one before paint, even in `"use cache"` server components. The rate is
 * `Settings.usdToBdtRate` (BDT per 1 USD).
 */

export const CURRENCIES = ["BDT", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const BASE_CURRENCY: Currency = "BDT";
export const CURRENCY_COOKIE = "ecomfy_currency";
/** Fallback when settings can't be read (also the seeded value). */
export const DEFAULT_USD_RATE = 123;

const formatters = {
  BDT: new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", currencyDisplay: "narrowSymbol" }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
};
const wholeFormatters = {
  BDT: new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
};

export const isCurrency = (v: unknown): v is Currency => v === "BDT" || v === "USD";

/** Poisha → US cents at `rate` BDT per USD (half-up). */
export function toUsdCents(poisha: number, rate: number): number {
  if (!(rate > 0)) return 0;
  return Math.round(poisha / rate);
}

/** Convert a BDT amount (poisha) to the display currency's minor units. */
export function toDisplayCents(poisha: number, currency: Currency, rate: number): number {
  return currency === "USD" ? toUsdCents(poisha, rate) : poisha;
}

/** "৳1,234.00" / "$10.03" for a BDT amount shown in `currency`. */
export function formatMoney(poisha: number, currency: Currency = "BDT", rate = DEFAULT_USD_RATE): string {
  return formatters[currency].format(toDisplayCents(poisha, currency, rate) / 100);
}

/** Whole units for ranges ("৳500 — ৳7,500"). */
export function formatMoneyWhole(poisha: number, currency: Currency = "BDT", rate = DEFAULT_USD_RATE): string {
  return wholeFormatters[currency].format(toDisplayCents(poisha, currency, rate) / 100);
}

/** BDT, for server strings, logs and gateway-facing text ("Pay ৳1,234.00"). */
export function formatPrice(poisha: number): string {
  return formatMoney(poisha, "BDT");
}

/** "64% Off" badge: percentage saved versus the compare-at price. */
export function discountPercent(priceCents: number, compareAtCents?: number | null): number {
  if (!compareAtCents || compareAtCents <= priceCents) return 0;
  return Math.round(((compareAtCents - priceCents) / compareAtCents) * 100);
}

/** Gateway amount string: poisha → "1234.50" taka. */
export function toTakaString(poisha: number): string {
  return (poisha / 100).toFixed(2);
}

/** "1234.50" / 1234.5 taka → poisha (for comparing gateway amounts). */
export function fromTaka(amount: string | number): number {
  const n = typeof amount === "number" ? amount : Number.parseFloat(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
}
