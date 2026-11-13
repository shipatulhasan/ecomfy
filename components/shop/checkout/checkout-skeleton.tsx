import { Skeleton } from "@/components/ui/skeleton";

/** /checkout while the cart and settings stream in: the loaded page's geometry. */
export function CheckoutSkeleton() {
  return (
    <div role="status" aria-label="Loading checkout" className="grid items-start gap-4 tablet:gap-6 laptop:grid-cols-[minmax(0,1fr)_26.5rem]">
      <Skeleton className="h-14 rounded-lg laptop:hidden" />
      <div className="flex flex-col gap-4">
        <Skeleton className="hidden h-9 w-56 laptop:block" />
        <div className="grid gap-4 tablet:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-19.5" />
          ))}
        </div>
        <Skeleton className="h-19.5" />
        <div className="grid gap-4 tablet:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-19.5" />
          ))}
        </div>
        <div className="grid gap-4 tablet:grid-cols-2">
          <Skeleton className="h-19.5" />
          <Skeleton className="h-19.5" />
        </div>
      </div>
      <Skeleton className="hidden h-145 rounded-lg laptop:block" />
    </div>
  );
}
