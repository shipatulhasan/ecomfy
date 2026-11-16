import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductRowsSkeleton() {
  return (
    <div aria-hidden className="mt-6">
      <Skeleton className="hidden h-12.5 w-full rounded-none laptop:block" />
      <ul className="flex flex-col divide-y divide-border">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="flex h-17.5 items-center gap-3 px-3">
            <Skeleton className="size-6 shrink-0 rounded" />
            <Skeleton className="size-10.5 shrink-0 rounded-lg" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-40 max-w-full" />
            </div>
            <Skeleton className="hidden h-3.5 w-16 laptop:block" />
            <Skeleton className="hidden h-3.5 w-16 laptop:block" />
            <Skeleton className="hidden h-3.5 w-12 laptop:block" />
            <Skeleton className="h-7 w-20 rounded-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ProductListSkeleton() {
  return (
    <Container variant="admin" className="py-5">
      <div className="rounded-xl bg-card p-4 tablet:p-6">
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="size-10 rounded-lg" />
          <Skeleton className="size-11 rounded-lg" />
          <Skeleton className="size-11 rounded-lg" />
        </div>
        <ProductRowsSkeleton />
      </div>
    </Container>
  );
}
