"use client";

import { HandbagIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cartCopy } from "@/lib/config/cart";
import { formatPrice } from "@/lib/money";
import { CartCountBadge } from "../header-client";
import { useCart } from "./cart-provider";
import { MiniCartFooter, MiniCartItems } from "./mini-cart";

/**
 * Header cart button + the mini cart (designs/screens/web/Shopping_Card_Popup.png).
 *
 * - Laptop+: bag, count and "Shopping cart: $57.00" open a right shadcn Sheet,
 *   456 design-px wide with 40 padding, as in the PNG.
 * - Below laptop: the bag icon opens a bottom sheet (vaul, drag to close). The
 *   tab bar's Cart tab still goes straight to /cart.
 *
 * Both are controlled by the cart store, so add-to-cart can open the mini cart
 * (`openDrawer`, which picks the sheet whose trigger CSS is showing). Closes on
 * overlay, Esc, the ✕, and route changes.
 */
export function CartDrawer() {
  const { ready, cart, drawer, setDrawer, registerTrigger } = useCart();
  const sideRef = useRef<HTMLButtonElement>(null);
  const bottomRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    registerTrigger("side", sideRef.current);
    registerTrigger("bottom", bottomRef.current);
    return () => {
      registerTrigger("side", null);
      registerTrigger("bottom", null);
    };
  }, [registerTrigger]);

  const count = cart.totals.count;
  const label = ready
    ? `Shopping cart, ${count} items, ${formatPrice(cart.totals.subtotalCents)}`
    : "Shopping cart";
  const title = cartCopy.drawerTitle(ready ? cart.lines.length : 0);

  return (
    <>
      <Suspense fallback={null}>
        <CloseOnNavigate />
      </Suspense>

      {/* Laptop+: side sheet */}
      <Sheet open={drawer === "side"} onOpenChange={(open) => setDrawer(open ? "side" : null)}>
        <SheetTrigger asChild>
          <button ref={sideRef} type="button" aria-label={label} className="tap-target hidden items-center gap-3 laptop:flex">
            <span className="relative">
              <HandbagIcon aria-hidden className="size-8 stroke-[1.5] text-foreground" />
              <CartCountBadge />
            </span>
            <span className="flex flex-col items-start">
              <span className="text-[0.6875rem] leading-tight text-text-body">Shopping cart:</span>
              {ready ? (
                <span className="text-copy font-medium text-foreground">{formatPrice(cart.totals.subtotalCents)}</span>
              ) : (
                <Skeleton className="mt-0.5 h-4 w-14" />
              )}
            </span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="right"
          showCloseButton={false}
          data-cart-drawer=""
          className="gap-0 p-10 laptop:data-[side=right]:w-[28.5rem] laptop:data-[side=right]:max-w-none"
        >
          <div className="flex h-11.25 items-center justify-between">
            <SheetTitle className="text-h4 font-normal text-foreground">{title}</SheetTitle>
            <SheetDescription className="sr-only">{cartCopy.drawerDescription}</SheetDescription>
            <SheetClose
              aria-label="Close cart"
              className="press -mr-2.5 grid size-11.25 place-items-center rounded-full text-foreground hover:bg-muted"
            >
              <XIcon aria-hidden className="size-6 stroke-[1.5]" />
            </SheetClose>
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <MiniCartItems />
          </div>
          <MiniCartFooter />
        </SheetContent>
      </Sheet>

      {/* Below laptop: bottom sheet */}
      <BottomSheet
        open={drawer === "bottom"}
        onOpenChange={(open) => setDrawer(open ? "bottom" : null)}
        title={title}
        description={undefined}
        footer={<MiniCartFooter />}
        trigger={
          <button
            ref={bottomRef}
            type="button"
            aria-label={label}
            className="tap-target press grid place-items-center laptop:hidden"
          >
            <span className="relative">
              <HandbagIcon aria-hidden className="size-7 stroke-[1.5] text-foreground" />
              <CartCountBadge />
            </span>
          </button>
        }
      >
        <MiniCartItems />
      </BottomSheet>
    </>
  );
}

/**
 * Close the mini cart when the route changes (pathname is URL data → its own
 * Suspense). Opening or closing the Quick View (/quick/[slug], an intercepted
 * modal over the same page) isn't leaving the page: adding from Quick View closes
 * it and opens the mini cart in the same moment.
 */
function CloseOnNavigate() {
  const pathname = usePathname();
  const { setDrawer } = useCart();
  const previous = useRef(pathname);
  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (from === pathname || from.startsWith("/quick/") || pathname.startsWith("/quick/")) return;
    setDrawer(null);
  }, [pathname, setDrawer]);
  return null;
}
