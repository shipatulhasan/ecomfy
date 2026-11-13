"use client";

import { ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { CURRENCIES, isCurrency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useCurrency } from "./currency-provider";

/** Topbar "BDT ⌄" (Checkout.png). Prices stay BDT; USD is converted at the settings rate. */
export function CurrencySwitcher({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Currency: ${currency}`}
        className={cn("flex items-center gap-1 outline-none hover:underline focus-visible:underline", className)}
      >
        {currency}
        <ChevronDownIcon aria-hidden className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-24">
        <DropdownMenuRadioGroup value={currency} onValueChange={(v) => isCurrency(v) && setCurrency(v)}>
          {CURRENCIES.map((c) => (
            <DropdownMenuRadioItem key={c} value={c}>
              {c}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Below laptop the topbar is hidden: a segmented BDT | USD control (Account tab, checkout). */
export function CurrencyToggle({ className }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  return (
    <div role="radiogroup" aria-label="Currency" className={cn("inline-flex rounded-full border border-border p-1", className)}>
      {CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={currency === c}
          onClick={() => setCurrency(c)}
          className={cn(
            "press tap-target rounded-full px-4 text-caption font-medium",
            currency === c ? "bg-primary text-primary-foreground" : "text-muted-foreground",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
