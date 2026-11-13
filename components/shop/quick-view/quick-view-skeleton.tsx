import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { QUICK_VIEW_INFO, QuickViewBar, QuickViewLayout } from "./quick-view-content";

/** Placeholder with the Quick View's geometry while the product streams in. */
export function QuickViewSkeleton() {
  return (
    <>
      <div className="min-h-0 flex-1 overflow-hidden" aria-busy="true" aria-label="Loading product">
        <QuickViewLayout
          gallery={
            <>
              <div className="hidden gap-3 laptop:flex">
                <div className="flex w-20 shrink-0 flex-col gap-3 pt-20.5">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-22.5 w-20 rounded-none" />
                  ))}
                </div>
                <Skeleton className="aspect-square max-w-139 min-w-0 flex-1 rounded-lg" />
              </div>
              <Skeleton className="mx-auto aspect-square max-h-[42dvh] w-full rounded-none laptop:hidden" />
            </>
          }
          info={
            <div className={cn("flex flex-col px-safe-gutter pt-5 pb-6 laptop:p-0", QUICK_VIEW_INFO)}>
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-3/5" />
                <Skeleton className="h-7 w-18" />
              </div>
              <Skeleton className="mt-3 h-5 w-64" />
              <Skeleton className="mt-5 h-9 w-56" />
              <Skeleton className="mt-5 h-px w-full" />
              <div className="mt-6 flex items-center justify-between">
                <Skeleton className="size-14" />
                <Skeleton className="h-10 w-56" />
              </div>
              <Skeleton className="mt-4 h-16 w-full" />
              <Skeleton className="mt-6 hidden h-22 w-full laptop:block" />
              <Skeleton className="mt-6 h-12 w-2/3" />
            </div>
          }
        />
      </div>
      <QuickViewBar>
        <Skeleton className="h-12.5 w-full rounded-full" />
      </QuickViewBar>
    </>
  );
}
