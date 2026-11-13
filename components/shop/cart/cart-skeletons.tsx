import { Skeleton } from "@/components/ui/skeleton";

/**
 * /cart while the visitor's cart streams in: the same geometry as the loaded page
 * (laptop: 872 table card with two 124-high rows + coupon card beside the 424 totals
 * card; below: line cards and totals), so nothing jumps when it lands.
 */
export function CartPageSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading your cart"
      className="grid items-start gap-4 tablet:gap-6 laptop:grid-cols-[minmax(0,1fr)_26.5rem]"
    >
      <div className="flex flex-col gap-4 tablet:gap-6">
        {/* laptop table */}
        <div className="hidden rounded-lg border border-border laptop:block">
          <div className="h-11.5 border-b border-border" />
          <div className="divide-y divide-border px-5">
            {[0, 1].map((i) => (
              <div key={i} className="flex h-31 items-center gap-3">
                <Skeleton className="size-25" />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="ml-auto h-12.5 w-31" />
                <Skeleton className="ml-10 h-5 w-16" />
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t border-border px-5 py-4">
            <Skeleton className="h-11.25 w-42 rounded-full" />
            <Skeleton className="h-11.25 w-38 rounded-full" />
          </div>
        </div>
        <Skeleton className="hidden h-23 rounded-lg laptop:block" />
        {/* cards below laptop */}
        <div className="grid gap-3 tablet:grid-cols-2 tablet:gap-4 laptop:hidden">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-13 rounded-lg laptop:hidden" />
      </div>
      <Skeleton className="h-60 rounded-lg laptop:h-74" />
    </div>
  );
}
