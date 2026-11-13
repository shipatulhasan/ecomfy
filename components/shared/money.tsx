"use client";

import { formatMoney, formatMoneyWhole } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useCurrency } from "./currency-provider";

/**
 * A BDT amount (poisha) shown in the visitor's currency. Renders both values;
 * CSS keyed on `html[data-currency]` (app/globals.css → Currency) shows one, set
 * before paint by the root layout's inline script. Server and client render the
 * same markup, so it works under `"use cache"` server components with no flash
 * and no hydration mismatch. The USD rate comes from <CurrencyProvider>.
 *
 * For plain strings (aria-labels, button labels) use `useCurrency().format`.
 */
export function Money({ cents, whole = false, className }: { cents: number; whole?: boolean; className?: string }) {
  const { rate } = useCurrency();
  const fmt = whole ? formatMoneyWhole : formatMoney;
  return (
    <span className={cn("tabular-nums", className)}>
      <span data-cur="BDT">{fmt(cents, "BDT", rate)}</span>
      <span data-cur="USD">{fmt(cents, "USD", rate)}</span>
    </span>
  );
}
