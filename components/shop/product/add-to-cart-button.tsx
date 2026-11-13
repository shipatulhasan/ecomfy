"use client";

import { CheckIcon, HandbagIcon } from "lucide-react";
import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";
import { toast } from "sonner";
import { cartCopy } from "@/lib/config/cart";
import { productCopy } from "@/lib/config/product";
import { cn } from "@/lib/utils";
import { useCart, type LinePreview } from "../cart/cart-provider";

type Props = {
  /** null while a multi-variant product has no option chosen: the button is disabled. */
  variantId: string | null;
  name: string;
  inStock: boolean;
  quantity?: number;
  /** Row data for the instant mini-cart line (without it, only the count moves until the server answers). */
  preview?: LinePreview;
  /** Open the mini cart once the add succeeds (default true). */
  openCart?: boolean;
  /** Runs after a successful add, before the mini cart opens (Quick View closes itself). */
  onAdded?: () => void;
  /** icon: round bag button on cards. full: pill "Add to Cart" (spotlight card, Quick View, PDP). */
  appearance?: "icon" | "full";
  className?: string;
};

const ADDED_MS = 1500;

/**
 * Optimistic add-to-cart through the cart store: the header count/total, the
 * tab-bar badge, the mini cart row and this button update at once ("Added ✓" while
 * pending and briefly after), then settle on the server's cart, or roll back with a
 * toast on error. On success the mini cart opens (side sheet on laptop+, bottom
 * sheet below).
 */
export function AddToCartButton({
  variantId,
  name,
  inStock,
  quantity = 1,
  preview,
  openCart = true,
  onAdded,
  appearance = "icon",
  className,
}: Props) {
  const cart = useCart();
  const [adding, setAdding] = useOptimistic(false);
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function add() {
    if (!variantId) return;
    startTransition(async () => {
      setAdding(true);
      const ok = await cart.add({
        variantId,
        quantity,
        preview,
      });
      if (!ok) return; // the store already showed the error toast
      setAdded(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setAdded(false), ADDED_MS);
      toast.success(cartCopy.added(name, quantity), { id: `added-${variantId}` });
      onAdded?.();
      if (openCart) cart.openDrawer();
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
