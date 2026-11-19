import { InfoIcon } from "lucide-react";
import { TrendBadge } from "@/components/admin/dashboard/trend";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatMoneyWhole } from "@/lib/money";
import { getTransactionKpis, type TxnKpi } from "@/lib/queries/admin/transactions";
import { cn } from "@/lib/utils";

/**
 * Transaction.png counters (323 × 143): title + "Last 7 days", the value with the
 * change beside it. Each card is its own Suspense boundary on the page; they share
 * one cached read (`payments` tag). Revenue and Completed show ↑/↓ like the PNG;
 * Pending (green) and Failed (red) show the plain change, as drawn.
 */
export type TxnKpiKind = "revenue" | "completed" | "pending" | "failed";

const TITLES: Record<TxnKpiKind, string> = {
  revenue: "Total Revenue",
  completed: "Completed Transactions",
  pending: "Pending Transactions",
  failed: "Failed Transactions",
};

const HINTS: Record<Exclude<TxnKpiKind, "revenue">, string> = {
  completed: "Charges and COD collections that succeeded (including ones refunded later), started in the period.",
  pending: "Attempts started in the period that are still waiting for the gateway or for delivery (COD).",
  failed: "Attempts started in the period that failed, were cancelled at the payment page or expired unpaid.",
};

function Plain({ kpi, tone }: { kpi: TxnKpi; tone: "success" | "sale" }) {
  if (kpi.changePct === null) return <span className="text-caption text-muted-foreground">new</span>;
  return (
    <span className={cn("text-caption font-medium tabular-nums", tone === "success" ? "text-success" : "text-sale")}>
      <span className="sr-only">change vs the previous 7 days: </span>
      {Math.abs(kpi.changePct) > 999 ? ">999" : Math.abs(kpi.changePct).toFixed(0)}%
    </span>
  );
}

export async function TxnKpiCard({ kind }: { kind: TxnKpiKind }) {
  const k = await getTransactionKpis();
  const kpi = k[kind];
  const value = kind === "revenue" ? formatMoneyWhole(k.revenue.current) : kpi.current.toLocaleString("en-US");
  const extra =
    kind === "revenue" || kind === "completed" ? (
      <TrendBadge changePct={kpi.changePct} />
    ) : (
      <Plain kpi={kpi} tone={kind === "pending" ? "success" : "sale"} />
    );

  return (
    <article className="flex h-full min-h-36 min-w-0 flex-col justify-between gap-3 rounded-xl bg-card px-4 py-5 tablet:px-6 tablet:py-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <h2 className="flex items-center gap-1.5 text-h3 text-foreground">
          {TITLES[kind]}
          {kind === "revenue" ? (
            <Tooltip>
              <TooltipTrigger className="tap-target -m-1 grid size-6 place-items-center rounded-full text-muted-foreground hover:text-foreground">
                <InfoIcon aria-hidden className="size-4" />
                <span className="sr-only">How total revenue is counted</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-72 text-caption">
                Money in, by the time the gateway settled it: successful bKash / SSLCommerz charges plus cash collected on
                delivery, minus refunds. Pending, failed and cancelled attempts don&apos;t count.
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="sr-only">. {HINTS[kind]}</span>
          )}
        </h2>
        <span className="text-caption text-muted-foreground" title={kind === "revenue" ? undefined : HINTS[kind]}>
          {k.label}
        </span>
      </div>
      <div>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-display font-bold text-foreground tabular-nums">{value}</span>
          {extra}
        </p>
        {kind === "revenue" && k.revenue.refundCount > 0 && (
          <p className="mt-1 text-caption text-muted-foreground tabular-nums">
            {formatMoneyWhole(k.revenue.grossCents)} in · <span className="text-sale">−{formatMoneyWhole(k.revenue.refundsCents)}</span>{" "}
            refunded ({k.revenue.refundCount})
          </p>
        )}
      </div>
    </article>
  );
}

export function TxnKpiSkeleton() {
  return (
    <div aria-hidden className="flex h-full min-h-36 flex-col justify-between rounded-xl bg-card px-4 py-5 tablet:px-6 tablet:py-7">
      <div className="flex justify-between gap-2">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-9 w-28" />
    </div>
  );
}
