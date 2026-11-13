import { CheckIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Money } from "@/components/shared/money";
import { StatusChip } from "@/components/shared/status-chip";
import { laptopSizes } from "@/lib/image-sizes";
import { orderProgressStep } from "@/lib/orders/status";
import type { AddressSnapshot, OrderDetail } from "@/lib/queries/account";
import { cn } from "@/lib/utils";

/**
 * Order_Details.png (984 card): billing | shipping (624) and the summary (288)
 * side by side, the 4-step progress tracker, then the products table.
 * Tablet: addresses side by side, summary below. Phones: everything stacked,
 * products as rows, tracker stays horizontal with caption labels.
 */
export function AddressesBox({ billing, shipping }: { billing: AddressSnapshot | null; shipping: AddressSnapshot | null }) {
  return (
    <div className="grid rounded-md border border-border tablet:grid-cols-2 tablet:divide-x tablet:divide-border">
      <AddressColumn title="Billing Address" address={billing} />
      <AddressColumn title="Shipping Address" address={shipping ?? billing} className="border-t border-border tablet:border-t-0" />
    </div>
  );
}

function AddressColumn({ title, address, className }: { title: string; address: AddressSnapshot | null; className?: string }) {
  return (
    <section className={cn("flex flex-col", className)}>
      <h3 className="border-b border-border px-5 py-4 text-copy font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {address ? (
        <div className="flex flex-col px-5 pt-3.5 pb-5">
          <p className="text-lead text-foreground">{address.name}</p>
          <p className="mt-2 text-copy text-text-subtle">
            {address.lines.map((l) => (
              <span key={l} className="block">
                {l}
              </span>
            ))}
          </p>
          {address.email && (
            <>
              <p className="mt-5 text-caption tracking-wide text-muted-foreground uppercase">Email</p>
              <p className="text-copy break-all text-foreground">{address.email}</p>
            </>
          )}
          {address.phone && (
            <>
              <p className="mt-3 text-caption tracking-wide text-muted-foreground uppercase">Phone</p>
              <p className="text-copy text-foreground">{address.phone}</p>
            </>
          )}
        </div>
      ) : (
        <p className="px-5 py-4 text-copy text-text-subtle">Not available</p>
      )}
    </section>
  );
}

export function SummaryBox({ order }: { order: OrderDetail }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: "Subtotal:", value: <Money cents={order.subtotalCents} /> },
    ...(order.discountCents > 0
      ? [{ label: order.couponCode ? `Discount (${order.couponCode})` : "Discount", value: <>−<Money cents={order.discountCents} /></> }]
      : []),
    { label: "Shipping", value: order.shippingCents > 0 ? <Money cents={order.shippingCents} /> : "Free" },
    ...(order.codFeeCents > 0 ? [{ label: "COD fee", value: <Money cents={order.codFeeCents} /> }] : []),
  ];
  return (
    <section aria-label="Order summary" className="rounded-md border border-border">
      <div className="flex items-stretch gap-5 border-b border-border px-5 py-4.5">
        <div className="min-w-0">
          <p className="text-caption tracking-wide whitespace-nowrap text-muted-foreground uppercase">Order ID:</p>
          <p className="mt-1.5 text-copy text-foreground">#{order.number}</p>
        </div>
        <span aria-hidden className="w-px bg-border" />
        <div className="min-w-0">
          <p className="text-caption tracking-wide text-muted-foreground uppercase">Payment Method:</p>
          <p className="mt-1.5 text-copy text-foreground">{order.paymentMethod}</p>
        </div>
      </div>
      <dl className="flex flex-col px-5 pt-1.5 pb-4.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between border-b border-border py-3 text-copy">
            <dt className="text-text-body">{r.label}</dt>
            <dd className="font-medium text-foreground">{r.value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3">
          <dt className="text-h4 font-normal text-foreground">Total</dt>
          <dd className="text-h4 font-semibold text-brand-dark">
            <Money cents={order.totalCents} />
          </dd>
        </div>
      </dl>
    </section>
  );
}

const steps = ["Order received", "Processing", "On the way", "Delivered"] as const;

/** 4 points (40 design-px) on a 760 line; done = check, current = filled number, next = dashed. */
export function OrderProgressTracker({ order }: { order: OrderDetail }) {
  const current = orderProgressStep(order.status);
  if (current === null) {
    return (
      <div className="flex items-center justify-center gap-3 py-2 text-copy text-text-body">
        This order is <StatusChip tone={order.statusView.tone}>{order.statusView.label}</StatusChip>
      </div>
    );
  }
  return (
    <ol aria-label="Order progress" className="relative grid grid-cols-4">
      {/* Track from the first to the last point center, filled up to the current step. */}
      <span aria-hidden className="absolute top-4 right-[12.5%] left-[12.5%] h-1.5 rounded-full bg-muted-strong laptop:top-5 laptop:h-2" />
      <span
        aria-hidden
        className="absolute top-4 left-[12.5%] h-1.5 rounded-full bg-primary laptop:top-5 laptop:h-2"
        style={{ width: `${(Math.min(current + 0.5, 3) / 3) * 75}%` }}
      />
      {steps.map((label, i) => {
        const done = i < current || current === 3;
        const active = i === current;
        return (
          <li key={label} aria-current={active ? "step" : undefined} className="relative flex flex-col items-center gap-2.5 laptop:gap-3">
            <span
              className={cn(
                "grid size-8 place-items-center rounded-full text-caption font-medium laptop:size-10 laptop:text-copy",
                done || active ? "bg-primary text-primary-foreground" : "border border-dashed border-primary bg-background text-primary",
              )}
            >
              {done ? <CheckIcon aria-hidden className="size-4 laptop:size-5" /> : String(i + 1).padStart(2, "0")}
            </span>
            <span className={cn("text-center text-caption tablet:text-copy", done || active ? "text-brand-dark" : "text-text-body")}>
              {label}
              <span className="sr-only">{done ? " (done)" : active ? " (current)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function OrderItemsTable({ order }: { order: OrderDetail }) {
  return (
    <>
      <table className="hidden w-full table-fixed text-left text-copy tablet:table">
        <colgroup>
          <col />
          <col className="w-36 laptop:w-42" />
          <col className="w-28 laptop:w-48" />
          <col className="w-32 laptop:w-45" />
        </colgroup>
        <thead className="bg-muted-strong text-caption font-medium tracking-wide text-text-body uppercase">
          <tr className="h-9">
            <th scope="col" className="pl-5 font-medium">
              Product
            </th>
            <th scope="col" className="font-medium">
              Price
            </th>
            <th scope="col" className="font-medium">
              Quantity
            </th>
            <th scope="col" className="pr-5 font-medium">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr+tr>td]:border-t [&>tr+tr>td]:border-border">
          {order.items.map((item) => (
            <tr key={item.id}>
              <td className="py-3 pl-5">
                <ItemName item={item} />
              </td>
              <td className="text-foreground">
                <Money cents={item.unitPriceCents} />
              </td>
              <td className="text-foreground">x{item.quantity}</td>
              <td className="pr-5 font-medium text-foreground">
                <Money cents={item.subtotalCents} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-border tablet:hidden">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-3">
            <ItemName item={item} className="min-w-0 flex-1" />
            <div className="text-right text-copy">
              <Money cents={item.subtotalCents} className="block font-medium text-foreground" />
              <span className="text-caption text-text-subtle">
                <Money cents={item.unitPriceCents} /> × {item.quantity}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function ItemName({ item, className }: { item: OrderDetail["items"][number]; className?: string }) {
  const name = (
    <>
      <span className="relative size-14 shrink-0 overflow-hidden rounded-sm bg-muted laptop:size-17.5">
        {item.imageUrl && (
          <Image src={item.imageUrl} alt="" fill sizes={`${laptopSizes(70)}, 3.5rem`} className="object-contain" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-copy text-foreground">{item.productName}</span>
        <span className="block text-caption text-text-subtle">{item.variantName}</span>
      </span>
    </>
  );
  return item.productSlug ? (
    <Link href={`/product/${item.productSlug}`} className={cn("flex items-center gap-3 hover:text-primary laptop:gap-5", className)}>
      {name}
    </Link>
  ) : (
    <div className={cn("flex items-center gap-3 laptop:gap-5", className)}>{name}</div>
  );
}
