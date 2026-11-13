"use client";

import {
  createContext,
  startTransition,
  use,
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  addToCart,
  applyCoupon as applyCouponAction,
  removeCoupon as removeCouponAction,
  removeItem,
  updateQuantity,
} from "@/lib/actions/cart";
import { moveToCart } from "@/lib/actions/wishlist";
import { buildCartView, EMPTY_CART, type CartCoupon, type CartLine, type CartView } from "@/lib/cart/pricing";
import { cartCopy, QUANTITY_DEBOUNCE_MS } from "@/lib/config/cart";
import { MAX_CART_QTY } from "@/lib/config/product";

/**
 * THE cart store, shared by the header (count + total), the tab-bar badge, the mini
 * cart and the /cart page, so they all move together.
 *
 * - Server state is a full `CartView` (lib/cart/pricing.ts). It arrives from
 *   <ShopStateLoader> (hydrate), and from every cart action's return value.
 * - `useOptimistic` layers pending changes on top (add, quantity, remove, coupon
 *   removal). Totals are recomputed with the same `buildCartView` the server uses,
 *   so the numbers don't jump when the server answer lands.
 * - Quantity changes are debounced per line: each tap applies at once, and one
 *   `updateQuantity` call goes out after the last tap. Every tap's transition
 *   waits for that call, so the optimistic value holds until the server's arrives.
 * - The mini cart's open state lives here too, so add-to-cart can open it.
 */

/** What an add-to-cart button knows about the line it's creating (for the instant row). */
export type LinePreview = {
  productId: string;
  slug: string;
  name: string;
  variantName: string;
  image: { url: string; alt: string } | null;
  unitCents: number;
  compareAtCents: number | null;
  stock?: number;
};

type CartAction =
  | { type: "add"; variantId: string; quantity: number; preview?: LinePreview }
  | { type: "setQty"; lineId: string; quantity: number }
  | { type: "remove"; lineId: string }
  | { type: "coupon"; coupon: CartCoupon | null };

export const isTempLine = (line: CartLine) => line.id.startsWith("tmp:");

function reduce(cart: CartView, action: CartAction): CartView {
  switch (action.type) {
    case "add": {
      const existing = cart.lines.find((l) => l.variantId === action.variantId);
      if (existing) {
        const quantity = Math.min(existing.quantity + action.quantity, existing.stock, MAX_CART_QTY);
        return buildCartView(
          cart.lines.map((l) => (l === existing ? { ...l, quantity } : l)),
          cart.coupon,
        );
      }
      const p = action.preview;
      if (!p) return cart; // count catches up when the server answers
      const line: CartLine = {
        id: `tmp:${action.variantId}`,
        variantId: action.variantId,
        productId: p.productId,
        slug: p.slug,
        name: p.name,
        variantName: p.variantName,
        image: p.image,
        unitCents: p.unitCents,
        compareAtCents: p.compareAtCents,
        quantity: action.quantity,
        stock: p.stock ?? MAX_CART_QTY,
        lineCents: p.unitCents * action.quantity,
        issue: null,
      };
      return buildCartView([...cart.lines, line], cart.coupon);
    }
    case "setQty":
      return buildCartView(
        cart.lines.map((l) => (l.id === action.lineId ? { ...l, quantity: action.quantity } : l)),
        cart.coupon,
      );
    case "remove":
      return buildCartView(
        cart.lines.filter((l) => l.id !== action.lineId),
        cart.coupon,
      );
    case "coupon":
      return buildCartView(cart.lines, action.coupon);
  }
}

export type DrawerKind = "side" | "bottom";

type CartStore = {
  /** False until the visitor's cart has streamed in: show skeletons. */
  ready: boolean;
  /** Optimistic. */
  cart: CartView;
  hydrate: (cart: CartView) => void;
  /**
   * Resolves true when the server accepted the add. `source: "wishlist"` goes
   * through `moveToCart`, which also checks the option belongs to the product.
   */
  add: (input: { variantId: string; quantity: number; preview?: LinePreview; source?: "wishlist" }) => Promise<boolean>;
  setQuantity: (line: CartLine, quantity: number) => void;
  remove: (line: CartLine) => void;
  /** Resolves with an error message for the inline coupon field, or null on success. */
  applyCoupon: (code: string) => Promise<string | null>;
  removeCoupon: () => void;
  /** Send debounced quantity changes now ("Update Cart", before checkout). */
  flush: () => Promise<void>;
  /** Mini cart: which sheet is open (null = closed). */
  drawer: DrawerKind | null;
  setDrawer: (kind: DrawerKind | null) => void;
  /** Registered by the header triggers; openAfterAdd opens the one that's visible. */
  registerTrigger: (kind: DrawerKind, el: HTMLElement | null) => void;
  openDrawer: () => void;
};

const CartContext = createContext<CartStore | null>(null);

type Pending = { quantity: number; timer: ReturnType<typeof setTimeout> | undefined; waiters: (() => void)[] };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [serverCart, setServerCart] = useState<CartView>(EMPTY_CART);
  const [cart, dispatch] = useOptimistic(serverCart, reduce);
  const [drawer, setDrawer] = useState<DrawerKind | null>(null);
  const triggers = useRef<Record<DrawerKind, HTMLElement | null>>({ side: null, bottom: null });
  const pending = useRef(new Map<string, Pending>());

  const adopt = useCallback((next: CartView) => startTransition(() => setServerCart(next)), []);

  const hydrate = useCallback((next: CartView) => {
    setServerCart(next);
    setReady(true);
  }, []);

  const add = useCallback<CartStore["add"]>(
    ({ variantId, quantity, preview, source }) =>
      new Promise((resolve) => {
        startTransition(async () => {
          dispatch({ type: "add", variantId, quantity, preview });
          const res =
            source === "wishlist" && preview
              ? await moveToCart({ productId: preview.productId, variantId })
              : await addToCart({ variantId, quantity });
          if (res.ok) adopt(res.data);
          else toast.error(res.error);
          resolve(res.ok);
        });
      }),
    [adopt, dispatch],
  );

  /** Send one line's latest debounced quantity and release every tap waiting on it. */
  const send = useCallback(
    async (lineId: string) => {
      const entry = pending.current.get(lineId);
      if (!entry) return;
      pending.current.delete(lineId);
      clearTimeout(entry.timer);
      const res = await updateQuantity({ lineId, quantity: entry.quantity });
      if (res.ok) adopt(res.data);
      else toast.error(res.error);
      entry.waiters.forEach((release) => release());
    },
    [adopt],
  );

  const setQuantity = useCallback<CartStore["setQuantity"]>(
    (line, quantity) => {
      if (isTempLine(line)) return; // its add is still in flight
      startTransition(async () => {
        dispatch({ type: "setQty", lineId: line.id, quantity });
        await new Promise<void>((release) => {
          const entry = pending.current.get(line.id) ?? { quantity, timer: undefined, waiters: [] };
          clearTimeout(entry.timer);
          entry.quantity = quantity;
          entry.waiters.push(release);
          entry.timer = setTimeout(() => void send(line.id), QUANTITY_DEBOUNCE_MS);
          pending.current.set(line.id, entry);
        });
      });
    },
    [dispatch, send],
  );

  const flush = useCallback(async () => {
    await Promise.all([...pending.current.keys()].map(send));
  }, [send]);

  const remove = useCallback<CartStore["remove"]>(
    (line) => {
      if (isTempLine(line)) return;
      const queued = pending.current.get(line.id);
      if (queued) {
        clearTimeout(queued.timer);
        pending.current.delete(line.id);
        queued.waiters.forEach((release) => release());
      }
      startTransition(async () => {
        dispatch({ type: "remove", lineId: line.id });
        const res = await removeItem({ lineId: line.id });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        adopt(res.data.cart);
        const removed = res.data.removed;
        if (!removed) return;
        toast(cartCopy.removed(line.name), {
          id: `removed-${line.id}`,
          action: {
            label: cartCopy.undo,
            onClick: () =>
              void add({
                variantId: removed.variantId,
                quantity: removed.quantity,
                preview: { ...line, stock: line.stock },
              }),
          },
        });
      });
    },
    [add, adopt, dispatch],
  );

  const applyCoupon = useCallback<CartStore["applyCoupon"]>(
    async (code) => {
      await flush(); // the minimum spend is checked against the saved quantities
      const res = await applyCouponAction({ code });
      if (!res.ok) return res.fieldErrors?.code?.[0] ?? res.error;
      adopt(res.data);
      toast.success(cartCopy.couponApplied(res.data.coupon?.code ?? code.toUpperCase()));
      return null;
    },
    [adopt, flush],
  );

  const removeCoupon = useCallback(() => {
    startTransition(async () => {
      dispatch({ type: "coupon", coupon: null });
      const res = await removeCouponAction();
      if (res.ok) {
        adopt(res.data);
        toast(cartCopy.couponRemoved);
      } else toast.error(res.error);
    });
  }, [adopt, dispatch]);

  const registerTrigger = useCallback((kind: DrawerKind, el: HTMLElement | null) => {
    triggers.current[kind] = el;
  }, []);

  // Which sheet to open is decided by which header trigger CSS is showing (the
  // side-sheet trigger is `hidden laptop:flex`). This reads the DOM's visibility,
  // not the viewport width: CSS stays the only place the breakpoint lives.
  const openDrawer = useCallback(() => {
    const side = triggers.current.side;
    setDrawer(side?.checkVisibility() ? "side" : "bottom");
  }, []);

  // Don't leave a debounced change unsent when the page goes away.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [flush]);

  const value = useMemo<CartStore>(
    () => ({
      ready,
      cart,
      hydrate,
      add,
      setQuantity,
      remove,
      applyCoupon,
      removeCoupon,
      flush,
      drawer,
      setDrawer,
      registerTrigger,
      openDrawer,
    }),
    [ready, cart, hydrate, add, setQuantity, remove, applyCoupon, removeCoupon, flush, drawer, registerTrigger, openDrawer],
  );

  return <CartContext value={value}>{children}</CartContext>;
}

export function useCart(): CartStore {
  const ctx = use(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}
