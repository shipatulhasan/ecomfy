import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { PageTransition } from "@/components/shared/page-transition";
import { CartPageView } from "@/components/shop/cart/cart-page-view";
import { CartPageSkeleton } from "@/components/shop/cart/cart-skeletons";
import { ProductSuggestions } from "@/components/shop/cart/cart-suggestions";
import { PageHero, type Crumb } from "@/components/shop/page-hero";
import { cartCopy } from "@/lib/config/cart";
import { getCart } from "@/lib/queries/cart";

/**
 * Shopping cart (designs/screens/web/Shopping_Cart.png). Per-visitor, so the cart
 * itself is read at request time; the shell (breadcrumb band, title) is static and
 * streams first, the cart follows behind a skeleton of the same shape.
 */
export const metadata: Metadata = {
  title: "Shopping Cart",
  robots: { index: false, follow: true },
};

const crumbs: Crumb[] = [{ label: "Home", href: "/" }, { label: cartCopy.crumb }];

export default function CartPage() {
  return (
    <PageTransition>
      <PageHero crumbs={crumbs} />
      <Container className="pt-6 pb-section tablet:pt-8 laptop:pt-10 laptop:pb-20">
        <h1 className="text-center text-h2 text-foreground">{cartCopy.pageTitle}</h1>
        <div className="mt-6 tablet:mt-8">
          <Suspense fallback={<CartPageSkeleton />}>
            <CartSection />
          </Suspense>
        </div>
      </Container>
    </PageTransition>
  );
}

async function CartSection() {
  const cart = await getCart();
  return <CartPageView initial={cart} suggestions={<ProductSuggestions title={cartCopy.suggestions} />} />;
}
