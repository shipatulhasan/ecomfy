import { TrendBadge } from "@/components/admin/dashboard/trend";
import { Skeleton } from "@/components/ui/skeleton";
import { getOrderKpis } from "@/lib/queries/admin/orders";

/**
 * Order Management.png counters (4 × 272, 112 high): title + "Last 7 days", the
 * value (32) with the trend beside it. The PNG's 3rd card shows a share ("85%")
 * instead of a trend; its 4th repeats "Completed Orders" but shows a red ↓, so
 * it is Cancelled Orders here.
 */
export async function OrderKpiCards() {
  const k = await getOrderKpis();
  const cards = [
    { title: "Total Orders", value: k.total.current, extra: <TrendBadge changePct={k.total.changePct} /> },
    { title: "New Orders", value: k.pending.current, extra: <TrendBadge changePct={k.pending.changePct} />, hint: "Waiting for confirmation or payment" },
    {
      title: "Completed Orders",
      value: k.completed.current,
      extra: <span className="text-caption font-medium text-success">{Math.round(k.completedShare)}%</span>,
      hint: "Share of the period's orders delivered",
    },
    { title: "Cancelled Orders", value: k.cancelled.current, extra: <TrendBadge changePct={k.cancelled.changePct} /> },
  ];
  return (
    <ul aria-label="Order counters" className="grid grid-cols-2 gap-3 tablet:gap-4 laptop:grid-cols-4">
      {cards.map((c) => (
        <li key={c.title} className="flex min-h-28 min-w-0 flex-col justify-between gap-3 rounded-xl bg-card px-4 pt-4 pb-4 tablet:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
            <h2 className="text-h3 text-foreground" title={c.hint}>
              {c.title}
            </h2>
            <span className="text-caption text-muted-foreground">{k.label}</span>
          </div>
          <p className="flex items-baseline gap-2">
            <span className="text-display font-bold text-foreground tabular-nums">{c.value.toLocaleString("en-US")}</span>
            {c.extra}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function OrderKpiSkeleton() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-3 tablet:gap-4 laptop:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex min-h-28 flex-col justify-between rounded-xl bg-card px-4 py-4 tablet:px-6">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}
