import { Skeleton } from "@/components/ui/skeleton";
import { REVIEWS_PAGE_SIZE } from "@/lib/config/product";

/** Same geometry as ReviewCard rows (streams while the reviews load). */
export function ReviewListSkeleton({ count = REVIEWS_PAGE_SIZE }: { count?: number }) {
  return (
    <div aria-busy="true" className="flex max-w-190 flex-col divide-y divide-border pt-6 laptop:pt-8">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 py-5 first:pt-0">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10.25 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
    </div>
  );
}
