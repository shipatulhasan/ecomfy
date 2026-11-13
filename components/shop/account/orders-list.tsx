import { format } from "date-fns";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/shared/money";
import { StatusChip } from "@/components/shared/status-chip";
import type { OrderRow } from "@/lib/queries/account";
import { cn } from "@/lib/utils";

/**
 * Order rows for the dashboard ("Recent Order History") and Order History.
 *
 * OrdersTable is the PNG table: a 36-high muted header (ORDER ID / DATE / TOTAL /
 * STATUS), 45-high rows, "View Details" right-aligned. Columns start at 24 / 200 /
 * 424 / 692 design-px inside the 984 card. OrderCards are the phone layout.
 */
export const orderDate = (d: Date) => format(d, "d MMM, yyyy");
export const productCount = (n: number) => `${n} Product${n === 1 ? "" : "s"}`;
export const orderHref = (n: number) => `/account/orders/${n}`;

export function OrdersTable({ rows, className }: { rows: OrderRow[]; className?: string }) {
  return (
    <table className={cn("w-full table-fixed text-left text-copy", className)}>
      <colgroup>
        <col className="w-50" />
        <col className="w-56" />
        <col className="w-67" />
        <col />
        <col className="w-32" />
      </colgroup>
      <thead className="bg-muted-strong text-caption font-medium tracking-wide text-text-body uppercase">
        <tr className="h-9">
          <th scope="col" className="pl-6 font-medium">
            Order ID
          </th>
          <th scope="col" className="font-medium">
            Date
          </th>
          <th scope="col" className="font-medium">
            Total
          </th>
          <th scope="col" className="font-medium">
            Status
          </th>
          <th scope="col" className="pr-6">
            <span className="sr-only">Details</span>
          </th>
        </tr>
      </thead>
      <tbody className="text-text-body [&>tr:first-child]:h-14.25 [&>tr:first-child>td]:pt-3 [&>tr:last-child]:h-14.25 [&>tr:last-child>td]:pb-3">
        {rows.map((o) => (
          <tr key={o.number} className="h-11.25">
            <td className="pl-6 text-foreground">#{o.number}</td>
            <td>{orderDate(o.createdAt)}</td>
            <td>
              <Money cents={o.totalCents} className="font-medium text-foreground" /> ({productCount(o.itemCount)})
            </td>
            <td>
              <StatusChip tone={o.status.tone}>{o.status.label}</StatusChip>
            </td>
            <td className="pr-6 text-right">
              <Link
                href={orderHref(o.number)}
                className="font-medium text-primary hover:text-brand-dark hover:underline"
                aria-label={`View details of order #${o.number}`}
              >
                View Details
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One tappable card per order (phones; the dashboard on tablet too). */
export function OrderCards({ rows, className }: { rows: OrderRow[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {rows.map((o) => (
        <li key={o.number}>
          <Link
            href={orderHref(o.number)}
            transitionTypes={["nav-forward"]}
            className="press flex items-center gap-3 rounded-lg border border-border bg-card p-4"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-copy font-medium text-foreground">#{o.number}</span>
                <StatusChip tone={o.status.tone}>{o.status.label}</StatusChip>
              </div>
              <div className="flex items-center justify-between gap-3 text-caption text-text-subtle">
                <span>
                  {orderDate(o.createdAt)} · {productCount(o.itemCount)}
                </span>
                <Money cents={o.totalCents} className="text-copy font-semibold text-foreground" />
              </div>
            </div>
            <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function NoOrders({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-10 text-center", className)}>
      <p className="text-copy text-text-subtle">You haven&apos;t placed any orders yet.</p>
      <Link
        href="/shop"
        className="press inline-flex h-11.25 items-center rounded-full bg-primary px-8 text-copy font-semibold text-primary-foreground hover:bg-brand-dark"
      >
        Start shopping
      </Link>
    </div>
  );
}
