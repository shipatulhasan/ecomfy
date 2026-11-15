import { CheckIcon, CircleAlertIcon, CircleXIcon, ClockIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Money } from "@/components/shared/money";
import { PaymentStatusBadge } from "@/components/shared/order-status-badge";
import { laptopSizes } from "@/lib/image-sizes";
import { formatOrderDateTime } from "@/lib/orders/format";
import { ORDER_STEPS, orderProgressStep, orderStatusView } from "@/lib/orders/status";
import type { AddressSnapshot, OrderDetail } from "@/lib/queries/orders";
import { cn } from "@/lib/utils";

/**
 * Order_Details.png (984 card), laptop+: billing | shipping (624) and the summary
 * (288) side by side, the 4-step horizontal tracker (or a status banner), then the
 * products table. Below laptop: vertical tracker, collapsible address / payment
 * sections and stacked product rows (app/(shop)/(account)/account/orders/[orderNumber]).
 */
export function AddressesBox({
  billing,
  shipping,
  className,
}: {
  billing: AddressSnapshot | null;
  shipping: AddressSnapshot | null;
  className?: string;
}) {
  return (
    <div className={cn("grid rounded-md border border-border tablet:grid-cols-2 tablet:divide-x tablet:divide-border", className)}>
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

export function SummaryBox({ order, className }: { order: OrderDetail; className?: string }) {
  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Payment",
      value: <PaymentStatusBadge paymentStatus={order.paymentStatus} method={order.paymentMethod} />,
    },
    ...(order.transactionId
      ? [{ label: "Transaction ID", value: <span className="font-mono text-caption break-all">{order.transactionId}</span> }]
      : []),
    { label: "Subtotal:", value: <Money cents={order.subtotalCents} /> },
    ...(order.discountCents > 0
      ? [
          {
            label: order.couponCode ? `Discount (${order.couponCode})` : "Discount",
            value: (
              <>
                −<Money cents={order.discountCents} />
              </>
            ),
          },
        ]
      : []),
    { label: "Shipping", value: order.shippingCents > 0 ? <Money cents={order.shippingCents} /> : "Free" },
    ...(order.codFeeCents > 0 ? [{ label: "COD fee", value: <Money cents={order.codFeeCents} /> }] : []),
  ];
  return (
    <section aria-label="Order summary" className={cn("rounded-md border border-border", className)}>
      <div className="flex items-stretch gap-5 border-b border-border px-5 py-4.5">
        <div className="min-w-0">
          <p className="text-caption tracking-wide whitespace-nowrap text-muted-foreground uppercase">Order ID:</p>
          <p className="mt-1.5 text-copy text-foreground">#{order.number}</p>
        </div>
        <span aria-hidden className="w-px bg-border" />
        <div className="min-w-0">
          <p className="text-caption tracking-wide text-muted-foreground uppercase">Payment Method:</p>
          <p className="mt-1.5 text-copy text-foreground">{order.paymentMethodLabel}</p>
        </div>
      </div>
      <dl className="flex flex-col px-5 pt-1.5 pb-4.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3 border-b border-border py-3 text-copy">
            <dt className="shrink-0 text-text-body">{r.label}</dt>
            <dd className="min-w-0 text-right font-medium text-foreground">{r.value}</dd>
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

// ───────────────────────────── progress ─────────────────────────────

/**
 * Laptop+: 4 points (40 design-px) on a 760 line; done = check, current = filled
 * number, next = dashed. The date each step was reached sits under its label.
 */
export function OrderProgressTracker({ order, className }: { order: OrderDetail; className?: string }) {
  const current = orderProgressStep(order.status);
  if (current === null) return null;
  return (
    <ol aria-label="Order progress" className={cn("relative grid grid-cols-4", className)}>
      {/* Track from the first to the last point center, filled up to the current step. */}
      <span aria-hidden className="absolute top-5 right-[12.5%] left-[12.5%] h-2 rounded-full bg-muted-strong" />
      <span
        aria-hidden
        className="absolute top-5 left-[12.5%] h-2 rounded-full bg-primary"
        style={{ width: `${(Math.min(current + 0.5, 3) / 3) * 75}%` }}
      />
      {ORDER_STEPS.map((step, i) => {
        const state = stepState(i, current);
        const date = state !== "next" ? order.stepDates[i] : null;
        return (
          <li key={step.label} aria-current={state === "current" ? "step" : undefined} className="relative flex flex-col items-center gap-3">
            <StepDot index={i} state={state} />
            <span className={cn("text-center text-copy", state === "next" ? "text-text-body" : "text-brand-dark")}>
              {step.label}
              <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current)" : ""}</span>
            </span>
            {date && <span className="-mt-2.5 text-caption text-text-subtle">{formatOrderDateTime(date)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Below laptop: the same steps top to bottom, with dates and the latest note. */
export function OrderProgressVertical({ order, className }: { order: OrderDetail; className?: string }) {
  const current = orderProgressStep(order.status);
  if (current === null) return null;
  return (
    <ol aria-label="Order progress" className={cn("flex flex-col", className)}>
      {ORDER_STEPS.map((step, i) => {
        const state = stepState(i, current);
        const date = state !== "next" ? order.stepDates[i] : null;
        const last = i === ORDER_STEPS.length - 1;
        return (
          <li key={step.label} aria-current={state === "current" ? "step" : undefined} className="flex gap-4">
            <div className="flex flex-col items-center">
              <StepDot index={i} state={state} small />
              {!last && <span aria-hidden className={cn("w-0.5 flex-1 rounded-full", i < current ? "bg-primary" : "bg-muted-strong")} />}
            </div>
            <div className={cn("flex min-h-8 flex-col pt-1", !last && "pb-5")}>
              <span className={cn("text-copy font-medium", state === "next" ? "text-text-body" : "text-foreground")}>
                {step.label}
                <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current)" : ""}</span>
              </span>
              {date && <span className="text-caption text-text-subtle">{formatOrderDateTime(date)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type StepState = "done" | "current" | "next";
const stepState = (i: number, current: number): StepState =>
  i < current || current === ORDER_STEPS.length - 1 ? "done" : i === current ? "current" : "next";

function StepDot({ index, state, small = false }: { index: number; state: StepState; small?: boolean }) {
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full font-medium",
        small ? "size-8 text-caption" : "size-10 text-copy",
        state === "next" ? "border border-dashed border-primary bg-background text-primary" : "bg-primary text-primary-foreground",
      )}
    >
      {state === "done" ? (
        <CheckIcon aria-hidden className={small ? "size-4" : "size-5"} />
      ) : (
        String(index + 1).padStart(2, "0")
      )}
    </span>
  );
}

/** Cancelled / expired / failed orders: this replaces the tracker at every width. */
export function OrderStatusBanner({ order, className }: { order: OrderDetail; className?: string }) {
  if (orderProgressStep(order.status) !== null) return null;
  const view = orderStatusView(order.status, order.paymentStatus, order.paymentMethod);
  const last = [...order.history].reverse().find((h) => h.status === order.status);
  const Icon = order.status === "EXPIRED" ? ClockIcon : order.status === "FAILED" ? CircleAlertIcon : CircleXIcon;
  const body =
    order.status === "FAILED"
      ? order.actions.payNow
        ? "The payment didn't go through. You can pay again; your order is kept."
        : "The payment didn't go through."
      : order.status === "EXPIRED"
        ? "The payment wasn't completed in time, so the items were released."
        : "This order was cancelled and its items were released.";
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-md border p-4",
        view.tone === "danger" ? "border-sale/30 bg-sale-soft" : "border-border bg-muted",
        className,
      )}
    >
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", view.tone === "danger" ? "text-sale" : "text-text-body")} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("text-copy font-semibold", view.tone === "danger" ? "text-sale" : "text-foreground")}>{view.label}</span>
          {last &&<span className="text-caption text-text-subtle">{formatOrderDateTime(last.createdAt)}</span>}
        </div>
        <p className="text-copy text-text-body">{body}</p>
        {last?.note && <p className="text-caption text-text-subtle">{last.note}</p>}
      </div>
    </div>
  );
}

// ───────────────────────────── products ─────────────────────────────

/** Laptop+: the PNG table. */
export function OrderItemsTable({ order, className }: { order: OrderDetail; className?: string }) {
  return (
    <table className={cn("w-full table-fixed text-left text-copy", className)}>
      <colgroup>
        <col />
        <col className="w-42" />
        <col className="w-48" />
        <col className="w-45" />
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
  );
}

/** Below laptop: stacked rows (photo, name + variant, subtotal over price × qty). */
export function OrderItemsList({ order, className }: { order: OrderDetail; className?: string }) {
  return (
    <ul className={cn("divide-y divide-border", className)}>
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
    <Link
      href={`/product/${item.productSlug}`}
      transitionTypes={["nav-forward"]}
      className={cn("flex items-center gap-3 hover:text-primary laptop:gap-5", className)}
    >
      {name}
    </Link>
  ) : (
    <div className={cn("flex items-center gap-3 laptop:gap-5", className)}>{name}</div>
  );
}
