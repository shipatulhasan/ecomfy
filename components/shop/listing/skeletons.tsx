import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProductGrid } from "../product-grid";
import { SHOP_PAGE_SIZE } from "@/lib/shop-params";

/** Filter sidebar while its options/URL state load: section titles + rows. */
export function FilterPanelSkeleton() {
  return (
    <div role="status" aria-label="Loading filters" className="flex flex-col">
      {[7, 2, 5, 4].map((rows, s) => (
        <div key={s} className="flex flex-col gap-3 border-b border-border py-5">
          <Skeleton className="h-6 w-2/5" />
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-5 w-3/5" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SaleProductsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-6 w-1/2" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  );
}

export const COUNT_SKELETON = <Skeleton className="h-6 w-36" />;

/** Card grid placeholder: same grid, gaps and framed "Product 4x" geometry as <ShopResults>. */
export function ResultsSkeleton() {
  return (
    <ProductGrid
      layout="sidebar"
      borders="gap"
      role="status"
      aria-label="Loading products"
      className="laptop:group-data-[sidebar=closed]/shop:grid-cols-4"
    >
      {Array.from({ length: SHOP_PAGE_SIZE }, (_, i) => (
        <div key={i} aria-hidden className="flex flex-col rounded-lg border border-border bg-card">
          <div className="p-1.25">
            <Skeleton className={cn("w-full rounded-t-lg", FRAMED_IMAGE_ASPECT)} />
          </div>
          <div className="flex items-center gap-2 px-3 pb-4 tablet:px-4 tablet:pb-5">
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="size-10 rounded-full" />
          </div>
        </div>
      ))}
    </ProductGrid>
  );
}

/** Must match the image box of <ProductCard variant="framed"> (Shop.png "Product 4x": 312×407 card). */
const FRAMED_IMAGE_ASPECT = "aspect-[302/320]";

/** Toolbar + grid while the search params resolve (outer boundary). */
export function ShopMainSkeleton({ className }: { className?: string }) {
  return (
    <>
      <div className={cn("flex items-center gap-3 [grid-area:toolbar] tablet:gap-6", className)}>
        <Skeleton className="h-11.25 w-32 rounded-full laptop:hidden" />
        <Skeleton className="h-10.25 flex-1 tablet:w-56 tablet:flex-none" />
        <div className="ml-auto hidden tablet:block">{COUNT_SKELETON}</div>
      </div>
      <div className="[grid-area:main]">
        <ResultsSkeleton />
      </div>
    </>
  );
}
