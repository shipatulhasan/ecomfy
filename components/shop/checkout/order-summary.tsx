"use client";

import Image from "next/image";
import { Money } from "@/components/shared/money";
import { useCurrency } from "@/components/shared/currency-provider";
import type { CartLine } from "@/lib/cart/pricing";
import type { CheckoutQuote } from "@/lib/checkout/pricing";
import { checkoutCopy } from "@/lib/config/checkout";
import { laptopSizes } from "@/lib/image-sizes";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

/** Checkout.png "Order Summery" rows: 60px image, "Name xN", line total. */
export function SummaryItems({ lines }: { lines: CartLine[] }) {
  return (
    <ul className="flex flex-col">
      {lines.map((l) => (
        <li key={l.id} className="flex h-15 items-center gap-1.5">
          <div className="relative size-15 shrink-0">
            {l.image && (
              <Image
                src={l.image.url}
                alt={l.image.alt}
                fill
                sizes={`${laptopSizes(60)}, 60px`}
                className="object-contain"
              />
            )}
          </div>
          <p className="min-w-0 flex-1 text-copy text-foreground">
            <span className="line-clamp-2">
              {l.name}
              <span className="ml-1.5 text-muted-foreground">x{l.quantity}</span>
            </span>
          </p>
          <Money cents={l.lineCents} className="text-copy font-medium text-foreground" />
        </li>
      ))}
    </ul>
  );
}

/** Subtotal / discount / shipping / COD fee / total, recomputed by the server quote. */
export function SummaryTotals({ quote, className }: { quote: CheckoutQuote; className?: string }) {
  const { currency } = useCurrency();
  const row = "flex items-center justify-between gap-3 py-3 text-copy";
  return (
    <dl className={cn("flex flex-col", className)} aria-live="polite">
      <div className={cn(row, "border-b border-border")}>
        <dt className="text-text-body">{checkoutCopy.subtotal}</dt>
        <dd className="font-medium text-foreground">
          <Money cents={quote.subtotalCents} />
        </dd>
      </div>
      {quote.discountCents > 0 && (
        <div className={cn(row, "border-b border-border")}>
          <dt className="text-text-body">{checkoutCopy.discount(quote.couponCode ?? "")}</dt>
          <dd className="font-medium text-primary">
            −<Money cents={quote.discountCents} />
          </dd>
        </div>
      )}
      <div className={cn(row, "border-b border-border")}>
        <dt className="text-text-body">
          {checkoutCopy.shipping}
          {quote.zone && <span className="ml-1 text-caption text-muted-foreground">({quote.zone.name})</span>}
        </dt>
        <dd className="font-medium text-foreground">
          {quote.shippingCents === null ? (
            <span className="text-muted-foreground">Choose district</span>
          ) : quote.shippingCents === 0 ? (
            checkoutCopy.free
          ) : (
            <Money cents={quote.shippingCents} />
          )}
        </dd>
      </div>
      {quote.codFeeCents > 0 && (
        <div className={cn(row, "border-b border-border")}>
          <dt className="text-text-body">{checkoutCopy.codFee}</dt>
          <dd className="font-medium text-foreground">
            <Money cents={quote.codFeeCents} />
          </dd>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 pt-3 text-lead">
        <dt className="text-text-body">{checkoutCopy.total}</dt>
        <dd className="text-h4 font-semibold text-foreground">
          <Money cents={quote.totalCents} />
        </dd>
      </div>
      {currency !== "BDT" && (
        <p className="pt-1 text-right text-caption text-muted-foreground">
          {checkoutCopy.chargedIn(formatPrice(quote.totalCents))}
        </p>
      )}
    </dl>
  );
}
