import { Skeleton } from "@/components/ui/skeleton";
import { getMethodBreakdown } from "@/lib/queries/admin/transactions";
import { MethodSwitcher } from "./method-switcher";

/**
 * Transaction.png "Payment Method" box (461 × 302). The PNG draws a saved-card
 * widget (card art, Add Card, Deactivate); this store's methods are bKash,
 * SSLCommerz and COD, so the box is a read-only switcher between them with the
 * same layout: card art, then Status / Transactions / Revenue / View Transactions,
 * and the method tabs where "Add Card" was. Methods are switched on and off in
 * store settings, not here (DESIGN.md).
 */
export async function MethodCard() {
  const { label, methods } = await getMethodBreakdown();
  return (
    <section aria-labelledby="method-card-title" className="@container flex h-full min-w-0 flex-col rounded-xl bg-card p-4 tablet:p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="method-card-title" className="text-h2 text-foreground">
          Payment Method
        </h2>
        <span className="text-caption text-muted-foreground">{label}</span>
      </div>
      <MethodSwitcher methods={methods} />
    </section>
  );
}

export function MethodCardSkeleton() {
  return (
    <div aria-hidden className="flex h-full min-h-75 flex-col gap-4 rounded-xl bg-card p-4 tablet:p-6">
      <Skeleton className="h-6 w-40" />
      <div className="flex flex-1 gap-4">
        <Skeleton className="aspect-[260/164] w-3/5 rounded-xl" />
        <div className="flex flex-1 flex-col gap-3 pt-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
