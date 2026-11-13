"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdaptiveSheet } from "@/components/shared/adaptive-sheet";
import { cartCopy, wishlistCopy } from "@/lib/config/cart";
import type { WishlistRow } from "@/lib/queries/wishlist";
import { useCurrency } from "@/components/shared/currency-provider";
import { cn } from "@/lib/utils";
import { useCart } from "../cart/cart-provider";
import { VariantSelector } from "../product/variant-selector";

/**
 * Wishlist "Add to Cart" pill. One option → adds at once and opens the mini cart.
 * Several → an option picker (bottom sheet below laptop, side sheet above), then
 * adds. The product stays on the wishlist. Out of stock → disabled grey pill.
 */
export function WishlistAddButton({ row, className }: { row: WishlistRow; className?: string }) {
  const cart = useCart();
  const { format } = useCurrency();
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inStock = row.stock > 0;

  const pill = cn(
    "press inline-flex h-11.5 items-center justify-center rounded-full px-6 text-copy font-semibold whitespace-nowrap",
    inStock
      ? "bg-primary text-primary-foreground hover:bg-brand-dark"
      : "cursor-not-allowed bg-muted text-muted-foreground",
    className,
  );

  function add(variantId: string, close?: () => void) {
    const v = row.variants.find((x) => x.id === variantId);
    if (!v) return;
    start(async () => {
      const ok = await cart.add({
        variantId,
        quantity: 1,
        source: "wishlist",
        preview: {
          productId: row.productId,
          slug: row.slug,
          name: row.name,
          variantName: v.name,
          image: row.image,
          unitCents: v.priceCents,
          compareAtCents: v.compareAtCents,
          stock: v.stock,
        },
      });
      if (!ok) return;
      close?.();
      toast.success(cartCopy.added(row.name, 1), { id: `added-${variantId}` });
      cart.openDrawer();
    });
  }

  if (!inStock) {
    return (
      <button type="button" disabled aria-label={`${row.name} is out of stock`} className={pill}>
        {wishlistCopy.addToCart}
      </button>
    );
  }

  if (row.variants.length < 2) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => add(row.variants[0]!.id)}
        aria-label={`Add ${row.name} to cart`}
        className={pill}
      >
        {wishlistCopy.addToCart}
      </button>
    );
  }

  const chosen = row.variants.find((v) => v.id === choice);
  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={setOpen}
      title={wishlistCopy.chooseTitle}
      description={wishlistCopy.chooseDescription(row.name)}
      trigger={
        <button type="button" aria-label={`Choose an option of ${row.name} to add to cart`} className={pill}>
          {wishlistCopy.addToCart}
        </button>
      }
      footer={
        <button
          type="button"
          disabled={!chosen || pending}
          onClick={() => chosen && add(chosen.id, () => setOpen(false))}
          className="press flex h-12 w-full items-center justify-center rounded-full bg-primary text-lead font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-50"
        >
          {chosen ? `${wishlistCopy.addToCart} · ${format(chosen.priceCents)}` : wishlistCopy.chooseTitle}
        </button>
      }
    >
      <VariantSelector options={row.variants} value={choice} onChange={setChoice} />
    </AdaptiveSheet>
  );
}
