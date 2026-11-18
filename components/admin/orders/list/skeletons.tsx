import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderKpiSkeleton } from "./kpi-cards";

/** Table rows (laptop+) / cards (below) while the list streams in. */
export function OrderRowsSkeleton() {
  return (
    <div aria-hidden className="mt-6">
      <Skeleton className="hidden h-14 w-full rounded-lg laptop:block" />
      <ul className="hidden flex-col divide-y divide-border laptop:flex">
        {Array.from({ length: 10 }, (_, i) => (
          <li key={i} className="flex h-17 items-center gap-4 px-3">
            <Skeleton className="size-5 shrink-0 rounded" />
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="ml-auto h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-5 w-24" />
          </li>
        ))}
      </ul>
      <ul className="grid gap-3 tablet:grid-cols-2 laptop:hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-48 max-w-full" />
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-md" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-4 w-full" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OrderListSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-6 py-5">
      <OrderKpiSkeleton />
      <div className="rounded-xl bg-card p-4 tablet:p-6">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-7 w-28" />
          <div className="flex gap-3">
            <Skeleton className="h-12 w-32 rounded-lg" />
            <Skeleton className="h-12 w-36 rounded-lg" />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Skeleton className="h-10 w-full max-w-120 rounded-lg" />
          <Skeleton className="ml-auto h-10 w-78 rounded-lg" />
        </div>
        <OrderRowsSkeleton />
      </div>
    </Container>
  );
}
