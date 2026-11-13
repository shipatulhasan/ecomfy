import { Suspense } from "react";
import { getPopularProducts } from "@/lib/queries/catalog";
import { laptopSizes } from "@/lib/image-sizes";
import { ProductCard } from "../product-card";
import { ProductRail, ProductRailItem, ProductRailSkeleton, RAIL_CARD } from "../product-grid";

const RAIL_SIZES = `${laptopSizes(264)}, (width >= 48rem) 30vw, 44vw`;

/**
 * Empty cart / empty wishlist: "Popular Products" as the Home rail (rail below
 * laptop, 5-column shared-border grid from laptop). The query is cached.
 */
export function ProductSuggestions({ title }: { title: string }) {
  return (
    <section aria-labelledby="suggestions-title" className="flex flex-col gap-6 tablet:gap-8">
      <h2 id="suggestions-title" className="text-h2 text-foreground">
        {title}
      </h2>
      <Suspense fallback={<ProductRailSkeleton count={5} />}>
        <SuggestionRail />
      </Suspense>
    </section>
  );
}

async function SuggestionRail() {
  const products = await getPopularProducts(5);
  return (
    <ProductRail>
      {products.map((p) => (
        <ProductRailItem key={p.id}>
          <ProductCard product={p} sizes={RAIL_SIZES} className={RAIL_CARD} />
        </ProductRailItem>
      ))}
    </ProductRail>
  );
}
