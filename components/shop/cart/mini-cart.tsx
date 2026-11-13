"use client";

import { HandbagIcon } from "lucide-react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cartCopy } from "@/lib/config/cart";
import { laptopSizes } from "@/lib/image-sizes";
import { Money } from "@/components/shared/money";
import { cn } from "@/lib/utils";
import { isTempLine, useCart } from "./cart-provider";
import { CartLineImage } from "./cart-line-image";
import { RemoveButton } from "./remove-button";

const IMAGE_SIZES = `${laptopSizes(120)}, 96px`;

/**
 * Mini cart rows (Figma "Shoping Cart Popup" 629:6643): 120×100 photo, name,
 * "1 kg x 12.00", round ✕; a divider between rows. Shared by the laptop side sheet
 * and the bottom sheet below laptop.
 */
export function MiniCartItems() {
  const { ready, cart, remove } = useCart();

  if (!ready) {
    return (
      <ul aria-busy="true" className="flex flex-col">
        {[0, 1].map((i) => (
          <li key={i} className="flex h-21 items-center gap-2 laptop:h-25">
            <Skeleton className="h-full w-24 laptop:w-30" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (cart.lines.length === 0) return <MiniCartEmpty />;

  return (
    <ul className="flex flex-col divide-y divide-border">
      {cart.lines.map((line) => (
        <li
          key={line.variantId}
          className={cn("flex items-center gap-2 py-3 first:pt-0 last:pb-0", line.issue && "opacity-70")}
        >
          <CartLineImage image={line.image} sizes={IMAGE_SIZES} className="h-21 w-24 laptop:h-25 laptop:w-30" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <Link
              href={`/product/${line.slug}`}
              transitionTypes={["nav-forward"]}
              className="truncate text-copy text-foreground hover:text-primary"
            >
              {line.name}
            </Link>
            <p className="text-copy text-muted-foreground">
              {line.variantName} x{" "}
              <span className="font-semibold text-foreground">{(line.unitCents / 100).toFixed(2)}</span>
              {line.quantity > 1 && <span className="ml-1">× {line.quantity}</span>}
            </p>
            {line.issue && (
              <p className="text-caption text-sale">
                {line.issue.kind === "out" ? cartCopy.outOfStock : cartCopy.onlyLeft(line.issue.available)}
              </p>
            )}
          </div>
          <RemoveButton
            label={cartCopy.remove(line.name)}
            onClick={() => remove(line)}
            disabled={isTempLine(line)}
          />
        </li>
      ))}
    </ul>
  );
}

function MiniCartEmpty() {
  const { setDrawer } = useCart();
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-secondary text-primary">
        <HandbagIcon aria-hidden className="size-7 stroke-[1.5]" />
      </span>
      <p className="text-h4 text-foreground">{cartCopy.emptyTitle}</p>
      <p className="text-copy text-muted-foreground">{cartCopy.emptyBody}</p>
      <Link
        href="/shop"
        onClick={() => setDrawer(null)}
        className="press tap-target mt-2 inline-flex h-11 items-center rounded-full bg-primary px-6 text-copy font-semibold text-primary-foreground hover:bg-brand-dark"
      >
        {cartCopy.continueShopping}
      </Link>
    </div>
  );
}

/** "2 Product … $26.00", then Checkout and Go To Cart (Figma "Frame 228" 376×186). */
export function MiniCartFooter() {
  const { ready, cart, flush, setDrawer } = useCart();
  if (ready && cart.lines.length === 0) return null;
  const button =
    "press flex h-12 w-full items-center justify-center rounded-full text-copy font-semibold laptop:h-[3.1875rem] laptop:text-lead";
  return (
    <div className="flex flex-col">
      <div className="flex h-14 items-center justify-between laptop:h-18">
        <div className="text-copy text-foreground laptop:text-lead">
          {ready ? cartCopy.productCount(cart.totals.count) : <Skeleton className="h-4 w-20" />}
        </div>
        <div className="text-lead font-semibold text-foreground">
          {ready ? <Money cents={cart.totals.subtotalCents} /> : <Skeleton className="h-4 w-16" />}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {cart.hasIssues ? (
          <span aria-disabled className={cn(button, "cursor-not-allowed bg-primary text-primary-foreground opacity-50")}>
            {cartCopy.checkout}
          </span>
        ) : (
          <Link
            href="/checkout"
            onClick={() => {
              void flush();
              setDrawer(null);
            }}
            className={cn(button, "bg-primary text-primary-foreground hover:bg-brand-dark")}
          >
            {cartCopy.checkout}
          </Link>
        )}
        <Link
          href="/cart"
          onClick={() => setDrawer(null)}
          className={cn(button, "bg-secondary text-primary hover:bg-primary hover:text-primary-foreground")}
        >
          {cartCopy.goToCart}
        </Link>
      </div>
      {cart.hasIssues && <p className="mt-2 text-caption text-sale">{cartCopy.fixIssues}</p>}
    </div>
  );
}
