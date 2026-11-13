"use client";

import { HandbagIcon } from "lucide-react";
import Link from "next/link";
import type { CartView } from "@/lib/cart/pricing";
import { cartCopy } from "@/lib/config/cart";
import { useCart } from "./cart-provider";
import { CartLineCards, CartTable } from "./cart-lines";
import { CartCheckoutBar, CartTotals } from "./cart-totals";
import { CouponCard } from "./coupon-form";

/**
 * /cart body (designs/screens/web/Shopping_Cart.png). Renders the server's cart on
 * first paint, then follows the shared optimistic store, so the header, tab bar,
 * mini cart and this page always agree.
 *
 * Laptop+: items table + coupon card (872) beside the Cart Total card (424), 24 apart.
 * Below laptop: line cards, coupon row and totals stacked, checkout in a sticky bar.
 */
export function CartPageView({ initial, suggestions }: { initial: CartView; suggestions: React.ReactNode }) {
  const store = useCart();
  const cart = store.ready ? store.cart : initial;

  if (cart.lines.length === 0) return <EmptyCart suggestions={suggestions} />;

  return (
    <div className="grid items-start gap-4 tablet:gap-6 laptop:grid-cols-[minmax(0,1fr)_26.5rem]">
      <div className="flex min-w-0 flex-col gap-4 tablet:gap-6">
        <CartTable lines={cart.lines} />
        <CartLineCards lines={cart.lines} />
        <CouponCard />
      </div>
      <CartTotals cart={cart} />
      <CartCheckoutBar cart={cart} />
    </div>
  );
}

function EmptyCart({ suggestions }: { suggestions: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-section">
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-12 text-center">
        <span className="grid size-18 place-items-center rounded-full bg-secondary text-primary">
          <HandbagIcon aria-hidden className="size-8 stroke-[1.5]" />
        </span>
        <h2 className="text-h3 text-foreground">{cartCopy.emptyTitle}</h2>
        <p className="text-copy text-muted-foreground">{cartCopy.emptyBody}</p>
        <Link
          href="/shop"
          className="press mt-2 inline-flex h-12 items-center rounded-full bg-primary px-8 text-copy font-semibold text-primary-foreground hover:bg-brand-dark"
        >
          {cartCopy.continueShopping}
        </Link>
      </div>
      {suggestions}
    </div>
  );
}
