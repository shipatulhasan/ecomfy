import { Suspense } from "react";
import { CurrencyProvider } from "@/components/shared/currency-provider";
import { CartProvider } from "@/components/shop/cart/cart-provider";
import { BottomNav } from "@/components/shop/mobile/bottom-nav";
import { NewsletterBand } from "@/components/shop/newsletter-band";
import { ShopStateProvider } from "@/components/shop/shop-state";
import { ShopStateLoader } from "@/components/shop/shop-state-loader";
import { SiteFooter } from "@/components/shop/site-footer";
import { SiteHeader } from "@/components/shop/site-header";
import { getStoreSettings } from "@/lib/queries/settings";

/**
 * Storefront chrome shared by every shop page. The layout itself is static; the
 * visitor's session / cart / wishlist stream in through <ShopStateLoader> inside
 * <Suspense> and land in the client stores (cart: header totals, mini cart, /cart; wishlist hearts).
 *
 * Below laptop it's an app shell: a compact sticky header plus the bottom tab bar
 * (CLAUDE.md → App shell).
 *
 * `modal` is the @modal parallel-route slot: intercepted routes such as the Product
 * Quick View (@modal/(.)quick/[slug]) render there, over the current page and
 * inside the shop store, so add-to-cart updates the header and tab bar at once.
 */
export default async function ShopLayout({ children, modal }: LayoutProps<"/">) {
  // Cached (cacheTag "settings"): the layout stays static.
  const { usdToBdtRate } = await getStoreSettings();
  return (
    <CurrencyProvider rate={usdToBdtRate}>
    <ShopStateProvider>
      <CartProvider>
        <Suspense fallback={null}>
          <ShopStateLoader />
        </Suspense>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <NewsletterBand />
        <SiteFooter />
        <BottomNav />
        {modal}
      </CartProvider>
    </ShopStateProvider>
    </CurrencyProvider>
  );
}
