import { Rail, RailItem } from "@/components/shared/rail";
import { Skeleton } from "@/components/ui/skeleton";
import { LISTING_GRID_SIZES, ProductCard } from "@/components/shop/product-card";
import { pdpCopy } from "@/lib/config/product";
import { getRelatedProducts } from "@/lib/queries/catalog";
import { cn } from "@/lib/utils";

/**
 * PDP "Related Products": centered heading, then four "Product 4x" cards (312,
 * 24 apart) on laptop+; a rail with the next card peeking below laptop.
 */
export async function RelatedProducts({
  productId,
  categorySlug,
  className,
}: {
  productId: string;
  categorySlug: string;
  className?: string;
}) {
  const products = await getRelatedProducts(productId, categorySlug, 4);
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="related-title" className={className}>
      <RelatedHeading />
      <Rail size="product" laptop="grid" className="mt-5 laptop:mt-8 laptop:grid-cols-4 laptop:gap-6">
        {products.map((p) => (
          <RailItem key={p.id}>
            <ProductCard product={p} variant="framed" sizes={LISTING_GRID_SIZES} className="h-full" />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}

function RelatedHeading() {
  return (
    <h2 id="related-title" className="text-h2 text-foreground laptop:text-center">
      {pdpCopy.relatedTitle}
    </h2>
  );
}

export function RelatedProductsSkeleton({ className }: { className?: string }) {
  return (
    <div aria-busy="true" className={className}>
      <RelatedHeading />
      <Rail size="product" laptop="grid" className="mt-5 laptop:mt-8 laptop:grid-cols-4 laptop:gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <RailItem key={i}>
            <Skeleton className={cn("aspect-[312/407] w-full rounded-lg")} />
          </RailItem>
        ))}
      </Rail>
    </div>
  );
}
