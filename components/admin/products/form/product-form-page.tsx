import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";

/** Layout skeleton for Add / Edit Product (header row, 634 | 485 cards). */
export function ProductFormSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <div className="flex gap-3">
          <Skeleton className="h-12 w-79 max-w-full rounded-lg" />
          <Skeleton className="hidden h-12 w-35 rounded-lg tablet:block" />
          <Skeleton className="hidden h-12 w-35 rounded-lg tablet:block" />
        </div>
      </div>
      <div className="grid gap-5 laptop:grid-cols-[634fr_485fr]">
        <Skeleton className="order-2 h-260 rounded-xl laptop:order-1" />
        <Skeleton className="order-1 h-220 rounded-xl laptop:order-2" />
      </div>
    </Container>
  );
}
