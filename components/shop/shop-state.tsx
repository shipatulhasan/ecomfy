"use client";

import { createContext, use, useCallback, useEffect, useMemo, useState } from "react";
import type { ShopUserState } from "@/lib/queries/user-state";
import { useCart } from "./cart/cart-provider";

/**
 * Per-visitor storefront state besides the cart (signed-in user, wishlist) shared
 * by the header and every product card. The cart has its own store
 * (components/shop/cart/cart-provider.tsx).
 *
 * The provider sits in app/(shop)/layout.tsx and renders statically; the real
 * values stream in from <ShopStateLoader> (inside <Suspense>), which reads the
 * session. Until then `ready` is false and consumers show skeletons.
 */
type ShopState = {
  ready: boolean;
  user: ShopUserState["user"];
  /** Product ids. Updated optimistically by the heart buttons. */
  wishlist: ReadonlySet<string>;
  setWishlisted: (productId: string, wishlisted: boolean) => void;
  hydrate: (state: Omit<ShopUserState, "cart">) => void;
};

const ShopStateContext = createContext<ShopState | null>(null);

export function ShopStateProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<ShopUserState["user"]>(null);
  const [wishlist, setWishlist] = useState<ReadonlySet<string>>(() => new Set());

  const setWishlisted = useCallback((productId: string, on: boolean) => {
    setWishlist((prev) => {
      if (prev.has(productId) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }, []);

  const hydrate = useCallback((s: Omit<ShopUserState, "cart">) => {
    setUser(s.user);
    setWishlist(new Set(s.wishlist));
    setReady(true);
  }, []);

  const value = useMemo<ShopState>(
    () => ({ ready, user, wishlist, setWishlisted, hydrate }),
    [ready, user, wishlist, setWishlisted, hydrate],
  );

  return <ShopStateContext value={value}>{children}</ShopStateContext>;
}

export function useShopState(): ShopState {
  const ctx = use(ShopStateContext);
  if (!ctx) throw new Error("useShopState must be used inside <ShopStateProvider>");
  return ctx;
}

/**
 * Rendered by the server <ShopStateLoader> once the session/cart/wishlist are read,
 * and again after every `refresh()` from a cart or wishlist action.
 */
export function ShopStateHydrator({ state }: { state: ShopUserState }) {
  const { hydrate } = useShopState();
  const { hydrate: hydrateCart } = useCart();
  useEffect(() => {
    hydrate(state);
    hydrateCart(state.cart);
  }, [hydrate, hydrateCart, state]);
  return null;
}
