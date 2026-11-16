import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";
import { DiscoverTilesSkeleton } from "./discover-tiles";

/** The table card while the rows stream in: toolbar, mint header, 64-high rows. */
export function CategoryListSkeleton() {
  return (
    <div role="status" aria-label="Loading categories" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-full max-w-130 rounded-lg" />
        <Skeleton className="h-11 flex-1 rounded-lg laptop:ml-auto laptop:max-w-104" />
        <Skeleton className="size-11 rounded-lg" />
        <Skeleton className="size-11 rounded-lg" />
        <Skeleton className="size-11 rounded-lg" />
      </div>
      <div>
        <Skeleton className="hidden h-14 w-full rounded-lg laptop:block" />
        <ul className="flex flex-col gap-3 laptop:gap-0 laptop:divide-y laptop:divide-border">
          {Array.from({ length: 8 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 rounded-xl border border-border p-3 laptop:h-16 laptop:rounded-none laptop:border-0 laptop:px-6 laptop:py-0">
              <Skeleton className="size-5 shrink-0 rounded" />
              <Skeleton className="size-12 shrink-0 rounded-lg laptop:size-10" />
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="ml-auto hidden h-4 w-24 laptop:block" />
              <Skeleton className="ml-auto hidden h-4 w-10 laptop:block" />
              <Skeleton className="ml-auto h-6 w-16" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function CategoryPageSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-6 py-5">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-7 w-32" />
        <div className="flex gap-3">
          <Skeleton className="h-12 w-48 rounded-lg" />
          <Skeleton className="h-12 w-32 rounded-lg" />
        </div>
      </div>
      <DiscoverTilesSkeleton />
      <section className="rounded-xl bg-card p-4 tablet:p-6">
        <CategoryListSkeleton />
      </section>
    </Container>
  );
}
