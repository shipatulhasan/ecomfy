"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { BASE_CURRENCY, CURRENCY_COOKIE, DEFAULT_USD_RATE, formatMoney, isCurrency, type Currency } from "@/lib/money";

/**
 * The visitor's display currency (BDT / USD) for Client Components. The source of
 * truth is `html[data-currency]`, set before paint from the cookie by
 * CURRENCY_INIT_SCRIPT, so `<Money>` (CSS) and `useCurrency()` always agree.
 */
type CurrencyStore = {
  currency: Currency;
  rate: number;
  /** Plain-string formatter for aria-labels, button labels, toasts. */
  format: (poisha: number) => string;
  setCurrency: (c: Currency) => void;
};

const CurrencyContext = createContext<CurrencyStore | null>(null);

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function readCurrency(): Currency {
  const v = document.documentElement.dataset.currency;
  return isCurrency(v) ? v : BASE_CURRENCY;
}

/** Runs inline in <head> (app/layout.tsx): cookie → html[data-currency] before first paint. */
export const CURRENCY_INIT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${CURRENCY_COOKIE}=(BDT|USD)/);document.documentElement.setAttribute("data-currency",m?m[1]:"${BASE_CURRENCY}")}catch(e){}})()`;

export function CurrencyProvider({ rate, children }: { rate: number; children: ReactNode }) {
  // Server snapshot is the base currency; <Money> renders both, so no text mismatches.
  const currency = useSyncExternalStore(subscribe, readCurrency, () => BASE_CURRENCY);

  const setCurrency = useCallback((c: Currency) => {
    document.documentElement.dataset.currency = c;
    document.cookie = `${CURRENCY_COOKIE}=${c}; path=/; max-age=31536000; samesite=lax`;
    listeners.forEach((l) => l());
  }, []);

  const value = useMemo<CurrencyStore>(
    () => ({ currency, rate, format: (p) => formatMoney(p, currency, rate), setCurrency }),
    [currency, rate, setCurrency],
  );
  return <CurrencyContext value={value}>{children}</CurrencyContext>;
}

const fallback: CurrencyStore = {
  currency: BASE_CURRENCY,
  rate: DEFAULT_USD_RATE,
  format: (p) => formatMoney(p, BASE_CURRENCY),
  setCurrency: () => {},
};

/** Display currency + formatter. Outside the provider (admin): BDT. */
export function useCurrency(): CurrencyStore {
  return useContext(CurrencyContext) ?? fallback;
}
