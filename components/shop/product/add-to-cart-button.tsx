"use client";

import { CheckIcon, HandbagIcon } from "lucide-react";
import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";
import { toast } from "sonner";
import { addToCart } from "@/lib/actions/cart";
import { productCopy } from "@/lib/config/product";
import { cn } from "@/lib/utils";
import { useShopState } from "../shop-state";

type Props = {
  /** null while a multi-variant product has no option chosen: the button is disabled. */
  variantId: string | null;
  name: string;
  priceCents: number;
  inStock: boolean;
  quantity?: number;
  /** icon: round bag button on cards. full: pill "Add to Cart" (spotlight card, Quick View, PDP). */
  appearance?: "icon" | "full";
  className?: string;
};

const ADDED_MS = 1500;

/**
 * Optimistic add-to-cart: the header count/total, the tab-bar badge and this button
 * update at once ("Added ✓" while pending and briefly after), then settle on the
 * server's numbers, or roll back with a toast on error.
 */
export function AddToCartButton({
  variantId,
  name,
  priceCents,
  inStock,
  quantity = 1,
  appearance = "icon",
  className,
}: Props) {
  const { addToCartOptimistic, setCart } = useShopState();
  const [adding, setAdding] = useOptimistic(false);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function add() {
    if (!variantId) return;
    startTransition(async () => {
      setAdding(true);
      addToCartOptimistic({ count: quantity, totalCents: priceCents * quantity });
      const result = await addToCart({ variantId, quantity });
      if (result.ok) {
        startTransition(() => setCart(result.data));
        setAdded(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setAdded(false), ADDED_MS);
        toast.success(quantity > 1 ? `${quantity} × ${name} added to cart` : `${name} added to cart`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const done = adding || added;
  const Icon = done ? CheckIcon : HandbagIcon;
  const needsChoice = !variantId;
  const disabled = !inStock || needsChoice;
  const label = !inStock
    ? `${name} is out of stock`
    : needsChoice
      ? `${productCopy.chooseOption} to add ${name} to cart`
      : quantity > 1
        ? `Add ${quantity} ${name} to cart`
        : `Add ${name} to cart`;

  if (appearance === "full") {
    const text = !inStock
      ? productCopy.outOfStockButton
      : needsChoice
        ? productCopy.selectOption
        : done
          ? productCopy.added
          : productCopy.addToCart;
    return (
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "press relative z-10 inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-primary px-6 text-copy font-semibold text-primary-foreground hover:bg-brand-dark disabled:opacity-50 disabled:hover:bg-primary",
          className,
        )}
      >
        <span className="truncate">{text}</span>
        {!disabled && (
          <Icon
            key={done ? "check" : "bag"}
            aria-hidden
            className="size-4.5 shrink-0 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200"
          />
        )}
        <span aria-live="polite" className="sr-only">
          {added ? `${name} added to cart` : ""}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "press relative z-10 grid size-10 shrink-0 place-items-center rounded-full bg-muted-strong text-foreground tap-target",
        "group-hover/card:bg-primary group-hover/card:text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        "disabled:opacity-50",
        done && "bg-primary text-primary-foreground",
        className,
      )}
    >
      <Icon key={done ? "check" : "bag"} aria-hidden className="size-5 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-200" />
    </button>
  );
}
