"use client";

import { createContext, use, useMemo, useState } from "react";
import { MAX_CART_QTY } from "@/lib/config/product";
import type { ProductVariantData } from "@/lib/queries/product";
import { cn } from "@/lib/utils";
import { AddToCartButton } from "./add-to-cart-button";
import { PriceBlock } from "./price-block";
import { QuantityStepper } from "./quantity-stepper";
import { SkuLabel } from "./rating-summary";
import { StockBadge } from "./stock-badge";
import { VariantSelector } from "./variant-selector";
import { WishlistButton } from "./wishlist-button";

/**
 * Selected variant + quantity for one product (Quick View, PDP). The info column is
 * server-rendered; only the leaves that follow the selection read this context.
 * A single-variant product is selected from the start; with 2+ nothing is selected
 * and the leaves show the default variant until the shopper chooses.
 */
type Purchase = {
  product: { id: string; slug: string; name: string };
  variants: ProductVariantData[];
  selected: ProductVariantData | null;
  /** What price / SKU show: the selection, else the default variant. */
  shown: ProductVariantData;
  select: (id: string) => void;
  quantity: number;
  setQuantity: (n: number) => void;
  maxQuantity: number;
};

const PurchaseContext = createContext<Purchase | null>(null);

function usePurchase() {
  const ctx = use(PurchaseContext);
  if (!ctx) throw new Error("Product purchase leaves must render inside <ProductPurchaseProvider>");
  return ctx;
}

export function ProductPurchaseProvider({
  product,
  variants,
  children,
}: {
  product: Purchase["product"];
  /** Default first, never empty (lib/queries/product.ts). */
  variants: ProductVariantData[];
  children: React.ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(variants.length === 1 ? variants[0]!.id : null);
  const [quantity, setQuantity] = useState(1);

  const value = useMemo<Purchase>(() => {
    const selected = variants.find((v) => v.id === selectedId) ?? null;
    const shown = selected ?? variants[0]!;
    const maxQuantity = Math.max(1, Math.min(shown.stock, MAX_CART_QTY));
    return {
      product,
      variants,
      selected,
      shown,
      select: setSelectedId,
      // Clamp when a smaller-stock option is chosen.
      quantity: Math.min(quantity, maxQuantity),
      setQuantity,
      maxQuantity,
    };
  }, [product, variants, selectedId, quantity]);

  return <PurchaseContext value={value}>{children}</PurchaseContext>;
}

export function SelectedPrice({ className }: { className?: string }) {
  const { shown } = usePurchase();
  return <PriceBlock priceCents={shown.priceCents} compareAtCents={shown.compareAtCents} className={className} />;
}

/** The selection's stock; before a choice, the product's total across options. */
export function SelectedStock({ className }: { className?: string }) {
  const { selected, variants } = usePurchase();
  const stock = selected ? selected.stock : variants.reduce((n, v) => n + v.stock, 0);
  return <StockBadge stock={stock} className={className} />;
}

export function SelectedSku() {
  const { shown } = usePurchase();
  return <SkuLabel sku={shown.sku} />;
}

export function VariantPicker({ className }: { className?: string }) {
  const { variants, selected, select } = usePurchase();
  return <VariantSelector options={variants} value={selected?.id ?? null} onChange={select} className={className} />;
}

/**
 * Quantity stepper | Add to Cart (fills the row) | wishlist heart.
 * inline: laptop+ row inside the info column (Figma "CTA"). bar: the pinned footer
 * below laptop, tightened so it fits 320px screens.
 */
export function PurchaseRow({ variant = "inline", className }: { variant?: "inline" | "bar"; className?: string }) {
  const { product, variants, selected, shown, quantity, setQuantity, maxQuantity } = usePurchase();
  // Before a choice: purchasable if any option is.
  const inStock = selected ? selected.stock > 0 : variants.some((v) => v.stock > 0);
  const bar = variant === "bar";
  return (
    <div className={cn("flex items-center", bar ? "gap-2" : "gap-3", className)}>
      <QuantityStepper value={quantity} onChange={setQuantity} max={maxQuantity} disabled={!inStock} compact={bar} />
      <AddToCartButton
        appearance="full"
        variantId={selected?.id ?? null}
        name={product.name}
        priceCents={shown.priceCents}
        inStock={inStock}
        quantity={quantity}
        // Phones: drop the bag icon so "Add to Cart" fits beside 44px stepper targets.
        className={
          bar ? "h-12.5 gap-1.5 px-3 text-copy tablet:px-6 tablet:text-lead [&>svg]:hidden tablet:[&>svg]:block" : "h-12.75 text-lead"
        }
      />
      <WishlistButton
        productId={product.id}
        name={product.name}
        appearance="soft"
        signInNext={`/product/${product.slug}`}
        className={bar ? "size-12.5" : undefined}
      />
    </div>
  );
}
