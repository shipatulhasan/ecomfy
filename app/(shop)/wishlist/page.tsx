import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { PageTransition } from "@/components/shared/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHero, type Crumb } from "@/components/shop/page-hero";
import { WishlistView } from "@/components/shop/wishlist/wishlist-view";
import { wishlistCopy } from "@/lib/config/cart";
import { getWishlist } from "@/lib/queries/wishlist";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Wishlist (designs/screens/web/Wishlist.png). Signed-in users' rows come from the
 * Wishlist table, guests' from their cookie. Static shell first, rows stream in.
 */
export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: true },
};

const crumbs: Crumb[] = [{ label: "Home", href: "/" }, { label: wishlistCopy.crumb }];

export default function WishlistPage() {
  return (
    <PageTransition>
      <PageHero crumbs={crumbs} />
      <Container className="pt-6 pb-section tablet:pt-8 laptop:pt-10 laptop:pb-20">
        <h1 className="text-center text-h2 text-foreground">{wishlistCopy.pageTitle}</h1>
        <div className="mt-6 tablet:mt-8">
          <Suspense fallback={<WishlistSkeleton />}>
            <WishlistSection />
          </Suspense>
        </div>
      </Container>
    </PageTransition>
  );
}

async function WishlistSection() {
  const rows = await getWishlist();
  return <WishlistView rows={rows} shareUrl={absoluteUrl("/wishlist")} />;
}

/** Same geometry as the loaded table (3 × 124-high rows + share row) / cards. */
function WishlistSkeleton() {
  return (
    <div role="status" aria-label="Loading your wishlist">
      <div className="hidden rounded-lg border border-border laptop:block">
        <div className="h-11.5 border-b border-border" />
        <div className="divide-y divide-border px-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex h-31 items-center gap-3">
              <Skeleton className="size-25" />
              <Skeleton className="h-5 w-48" />
              <Skeleton className="ml-auto h-11.5 w-38 rounded-full" />
            </div>
          ))}
        </div>
        <div className="h-22 border-t border-border" />
      </div>
      <div className="grid gap-3 tablet:grid-cols-2 tablet:gap-4 laptop:hidden">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-44 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
