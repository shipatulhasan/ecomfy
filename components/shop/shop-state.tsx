"use client";

import { createContext, use, useCallback, useEffect, useMemo, useOptimistic, useState } from "react";
import type { CartSummary, ShopUserState } from "@/lib/queries/user-state";

/**
 * Per-visitor storefront state (cart summary, wishlist, signed-in user) shared by
 * the header and every product card.
 *
 * The provider sits in app/(shop)/layout.tsx and renders statically; the real
 * values stream in from <ShopStateLoader> (inside <Suspense>), which reads the
 * session. Until then `ready` is false and consumers show skeletons.
 */
type ShopState = {
  ready: boolean;
  user: ShopUserState["user"];
  /** Optimistic: includes pending add-to-cart updates. */
  cart: CartSummary;
  wishlist: ReadonlySet<string>;
  /** Call inside a transition, before awaiting the server action. */
  addToCartOptimistic: (delta: CartSummary) => void;
  setCart: (cart: CartSummary) => void;
  setWishlisted: (productId: string, wishlisted: boolean) => void;
  hydrate: (state: ShopUserState) => void;
};

const ShopStateContext = createContext<ShopState | null>(null);

export function ShopStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<ShopUserState["user"]>(null);
  const [cart, setCart] = useState<CartSummary>({ count: 0, totalCents: 0 });
  const [wishlist, setWishlist] = useState<ReadonlySet<string>>(() => new Set());
  const [optimisticCart, addToCartOptimistic] = useOptimistic(
    cart,
    (current, delta: CartSummary) => ({
      count: current.count + delta.count,
      totalCents: current.totalCents + delta.totalCents,
    }),
  );

  const setWishlisted = useCallback((productId: string, on: boolean) => {
    setWishlist((prev) => {
      const next = new Set(prev);
      if (on) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  const hydrate = useCallback((s: ShopUserState) => {
    setUser(s.user);
    setCart(s.cart);
    setWishlist(new Set(s.wishlist));
    setReady(true);
  }, []);

  const value = useMemo<ShopState>(
    () => ({
      ready,
      user,
      cart: optimisticCart,
      wishlist,
      addToCartOptimistic,
      setCart,
      setWishlisted,
      hydrate,
    }),
    [ready, user, optimisticCart, wishlist, addToCartOptimistic, setWishlisted, hydrate],
  );

  return <ShopStateContext value={value}>{children}</ShopStateContext>;
}

export function useShopState(): ShopState {
  const ctx = use(ShopStateContext);
  if (!ctx) throw new Error("useShopState must be used inside <ShopStateProvider>");
  return ctx;
}

/** Rendered by the server <ShopStateLoader> once the session/cart are read. */
export function ShopStateHydrator({ state }: { state: ShopUserState }) {
  const { hydrate } = useShopState();
  useEffect(() => hydrate(state), [hydrate, state]);
  return null;
}
