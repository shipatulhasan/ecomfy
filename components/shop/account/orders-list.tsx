import { ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Money } from "@/components/shared/money";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { Rail, RailItem } from "@/components/shared/rail";
import { formatOrderDate, orderHref, productCount } from "@/lib/orders/format";
import type { OrderRow } from "@/lib/queries/orders";
import { cn } from "@/lib/utils";

/**
 * Order rows, shared by the dashboard ("Recent Order History") and Order History
 * so both stay identical.
 *
 * - Laptop+: `OrdersTable` / `OrderTableRow` is the PNG table: a 36-high muted header
 *   (ORDER ID / DATE / TOTAL / STATUS), 45-high rows, "View Details" right-aligned.
 *   Columns start at 24 / 200 / 424 / 692 design-px inside the 984 card.
 * - Below laptop: `OrderCard`, one tappable card per order with its item thumbnails.
 */

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
          <OrderTableRow key={o.number} order={o} />
        ))}
      </tbody>
    </table>
  );
}

export function OrderTableRow({ order: o }: { order: OrderRow }) {
  return (
    <tr className="h-11.25">
      <td className="pl-6 text-foreground">#{o.number}</td>
      <td>{formatOrderDate(o.createdAt)}</td>
      <td>
        <Money cents={o.totalCents} className="font-medium text-foreground" /> ({productCount(o.itemCount)})
      </td>
      <td>
        <OrderStatusBadge status={o.status} paymentStatus={o.paymentStatus} method={o.paymentMethod} />
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
  );
}

export function OrderCards({ rows, className }: { rows: OrderRow[]; className?: string }) {
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {rows.map((o) => (
        <li key={o.number}>
          <OrderCard order={o} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Order #, date, status, a small rail of item photos, total and a chevron. The
 * whole card is the link (stretched `card-link`); the thumbnail rail sits above it
 * so it can still be swiped.
 */
export function OrderCard({ order: o }: { order: OrderRow }) {
  return (
    <article className="press-card relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-copy font-medium text-foreground">
          <Link
            href={orderHref(o.number)}
            transitionTypes={["nav-forward"]}
            data-slot="card-link"
            className="after:absolute after:inset-0 after:rounded-lg"
          >
            Order #{o.number}
          </Link>
        </h3>
        <OrderStatusBadge status={o.status} paymentStatus={o.paymentStatus} method={o.paymentMethod} />
      </div>
      {o.thumbs.length > 0 && (
        <Rail size="thumb" bleed={false} aria-label={`Items in order #${o.number}`} className="relative z-10 gap-2 tablet:gap-2">
          {o.thumbs.map((t, i) => (
            <RailItem key={`${t.url}-${i}`}>
              <span className="relative block size-12 overflow-hidden rounded-md bg-muted">
                <Image src={t.url} alt={t.alt} fill sizes="3rem" className="object-contain p-1" />
              </span>
            </RailItem>
          ))}
          {o.itemCount > o.thumbs.length && (
            <RailItem>
              <span className="grid size-12 place-items-center rounded-md bg-muted text-caption font-medium text-text-body">
                +{o.itemCount - o.thumbs.length}
              </span>
            </RailItem>
          )}
        </Rail>
      )}
      <div className="flex items-center gap-3">
        <span className="flex-1 text-caption text-text-subtle">
          {formatOrderDate(o.createdAt)} · {productCount(o.itemCount)}
        </span>
        <Money cents={o.totalCents} className="text-copy font-semibold text-foreground" />
        <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
      </div>
    </article>
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
