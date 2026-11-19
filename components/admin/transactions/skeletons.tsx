import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";
import { MethodCardSkeleton } from "./method-card";
import { TxnKpiSkeleton } from "./kpi-cards";

/** Table rows (laptop+) / cards (below) while the list streams in. */
export function TxnRowsSkeleton() {
  return (
    <div aria-hidden className="mt-6">
      <Skeleton className="hidden h-14 w-full rounded-lg laptop:block" />
      <ul className="hidden flex-col divide-y divide-border laptop:flex">
        {Array.from({ length: 10 }, (_, i) => (
          <li key={i} className="grid h-15.5 grid-cols-7 items-center gap-4 px-3">
            <Skeleton className="mx-auto h-4 w-28" />
            <Skeleton className="mx-auto h-4 w-24" />
            <Skeleton className="mx-auto h-4 w-20" />
            <Skeleton className="mx-auto h-4 w-16" />
            <Skeleton className="mx-auto h-6 w-12" />
            <Skeleton className="mx-auto h-4 w-20" />
            <Skeleton className="mx-auto h-4 w-20" />
          </li>
        ))}
      </ul>
      <ul className="grid gap-3 tablet:grid-cols-2 laptop:hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-4 w-48 max-w-full" />
            <div className="flex justify-between">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TxnPageSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-6 py-5">
      <div className="flex flex-col gap-4 laptop:grid laptop:grid-cols-[323fr_323fr_461fr]">
        <div className="grid grid-cols-2 gap-3 tablet:gap-4 laptop:col-span-2">
          {Array.from({ length: 4 }, (_, i) => (
            <TxnKpiSkeleton key={i} />
          ))}
        </div>
        <MethodCardSkeleton />
      </div>
      <div className="rounded-xl bg-card p-4 tablet:p-6">
        <Skeleton className="h-10 w-full max-w-120" />
        <TxnRowsSkeleton />
      </div>
    </Container>
  );
}

/** The detail sheet body while it loads. */
export function TxnDetailSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ))}
    </div>
  );
}
