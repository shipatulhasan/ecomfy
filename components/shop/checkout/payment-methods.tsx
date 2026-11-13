"use client";

import Image from "next/image";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CheckoutQuote } from "@/lib/checkout/pricing";
import { checkoutCopy, PAYMENT_METHODS, paymentMethodMeta, sslczAccepted } from "@/lib/config/checkout";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Payment method radio group: three tappable cards with logo and short
 * description; the selected one expands with its note. A method that isn't
 * allowed (COD over the limit / district / off, a gateway turned off) is
 * disabled with the reason shown. The ৳ amounts are what will be charged (BDT).
 */
export function PaymentMethods({
  value,
  onChange,
  quote,
  codFeeCents,
  idPrefix,
}: {
  value: PaymentMethod;
  onChange: (m: PaymentMethod) => void;
  quote: CheckoutQuote;
  /** Settings fee, shown on the COD card even before COD is selected. */
  codFeeCents: number;
  idPrefix: string;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as PaymentMethod)}
      aria-label={checkoutCopy.paymentTitle}
      className="flex flex-col gap-3"
    >
      {PAYMENT_METHODS.map((m) => {
        const meta = paymentMethodMeta[m];
        const avail = quote.methods[m];
        const selected = value === m;
        const id = `${idPrefix}-${m}`;
        return (
          <Label
            key={m}
            htmlFor={id}
            data-selected={selected}
            data-disabled={!avail.enabled}
            className={cn(
              "press flex cursor-pointer flex-col items-stretch gap-0 rounded-lg border border-border bg-card p-4 font-normal transition-colors",
              "data-[selected=true]:border-primary data-[selected=true]:bg-secondary",
              "data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-60",
            )}
          >
            <span className="flex items-center gap-3">
              <RadioGroupItem id={id} value={m} disabled={!avail.enabled} />
              <span className="min-w-0 flex-1">
                <span className="block text-copy font-medium text-foreground">{meta.label}</span>
                <span className="block text-caption text-muted-foreground">
                  {avail.enabled ? meta.description : (avail.reason ?? checkoutCopy.methodOff)}
                </span>
              </span>
              <Image src={meta.logo} alt="" width={56} height={28} unoptimized className="h-7 w-14 shrink-0 object-contain" />
            </span>
            {selected && avail.enabled && (
              <span className="mt-3 block border-t border-border pt-3 text-caption text-text-body">
                {m === "BKASH" && checkoutCopy.bkashNote(formatPrice(quote.totalCents))}
                {m === "SSLCOMMERZ" && (
                  <>
                    {checkoutCopy.sslczNote}
                    <span className="mt-2 flex flex-wrap gap-2">
                      {sslczAccepted.map((l) => (
                        <Image key={l.src} src={l.src} alt={l.alt} width={44} height={28} unoptimized className="h-7 w-11 object-contain" />
                      ))}
                    </span>
                  </>
                )}
                {m === "COD" && checkoutCopy.codNote(codFeeCents > 0 ? formatPrice(codFeeCents) : null)}
              </span>
            )}
          </Label>
        );
      })}
    </RadioGroup>
  );
}
