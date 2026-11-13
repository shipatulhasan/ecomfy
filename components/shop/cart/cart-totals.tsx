"use client";

import Link from "next/link";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import type { CartView } from "@/lib/cart/pricing";
import { cartCopy } from "@/lib/config/cart";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";

/**
 * "Cart Total" card (Figma 460:42604, 424×296): Subtotal / (Discount) / Shipping /
 * Total rows with dividers, then "Proceed to checkout". Below laptop the button
 * moves into a sticky bar above the tab bar with the total in its label.
 */
export function CartTotals({ cart }: { cart: CartView }) {
  const { totals, coupon } = cart;
  const row = "flex items-center justify-between border-b border-border py-3 text-copy";
  return (
    <section
      aria-labelledby="cart-total-title"
      className="flex flex-col rounded-lg border border-border bg-card p-4 tablet:p-6"
    >
      <h2 id="cart-total-title" className="text-h4 font-medium text-foreground">
        {cartCopy.totalsTitle}
      </h2>
      <dl className="mt-2 flex flex-col tabular-nums">
        <div className={row}>
          <dt className="text-text-body">{cartCopy.subtotalLabel}</dt>
          <dd className="font-medium text-foreground">{formatPrice(totals.subtotalCents)}</dd>
        </div>
        {coupon && totals.discountCents > 0 && (
          <div className={row}>
            <dt className="text-text-body">{cartCopy.discountLabel(coupon.code)}</dt>
            <dd className="font-medium text-primary">−{formatPrice(totals.discountCents)}</dd>
          </div>
        )}
        <div className={row}>
          <dt className="text-text-body">{cartCopy.shippingLabel}</dt>
          <dd className="font-medium text-foreground">
            {totals.shippingCents === 0 ? cartCopy.free : formatPrice(totals.shippingCents)}
          </dd>
        </div>
        <div className="flex items-center justify-between py-3 text-lead">
          <dt className="text-text-body">{cartCopy.totalLabel}</dt>
          <dd className="font-semibold text-foreground">{formatPrice(totals.totalCents)}</dd>
        </div>
      </dl>
      <div className="mt-5 hidden flex-col gap-2 laptop:flex">
        <CheckoutButton disabled={cart.hasIssues} />
        {cart.hasIssues && <p className="text-caption text-sale">{cartCopy.fixIssues}</p>}
      </div>
    </section>
  );
}

function CheckoutButton({ disabled, label, className }: { disabled: boolean; label?: string; className?: string }) {
  const { flush } = useCart();
  const base =
    "press flex h-12 w-full items-center justify-center rounded-full bg-primary px-6 text-copy font-semibold text-primary-foreground tablet:text-lead laptop:h-[3.1875rem]";
  if (disabled) {
    return (
      <span role="link" aria-disabled="true" className={cn(base, "cursor-not-allowed opacity-50", className)}>
        {label ?? cartCopy.proceed}
      </span>
    );
  }
  return (
    <Link href="/checkout" onClick={() => void flush()} className={cn(base, "hover:bg-brand-dark", className)}>
      {label ?? cartCopy.proceed}
    </Link>
  );
}

/** Below laptop: "Proceed to checkout · $84.00" pinned above the tab bar. */
export function CartCheckoutBar({ cart }: { cart: CartView }) {
  return (
    <StickyActionBar>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <CheckoutButton
          disabled={cart.hasIssues}
          label={`${cartCopy.proceed} · ${formatPrice(cart.totals.totalCents)}`}
        />
      </div>
    </StickyActionBar>
  );
}
