import { ArrowLeftIcon, ExternalLinkIcon, PhoneIcon, ShieldAlertIcon, TriangleAlertIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/shared/order-status-badge";
import { DetailCard, DetailRow } from "@/components/admin/detail-blocks";
import { StatusChip } from "@/components/shared/status-chip";
import { formatDhaka } from "@/lib/admin/date-range";
import { adminOrderHref, METHOD_LABELS, orderRef } from "@/lib/admin/orders/params";
import { formatPrice } from "@/lib/money";
import { emailKindFor } from "@/lib/orders/email-kind";
import { ADMIN_STATUS_LABELS, ATTEMPT_LABEL, ATTEMPT_TONE } from "@/lib/orders/status";
import type { AdminOrderDetail } from "@/lib/queries/admin/orders";
import type { AddressSnapshot } from "@/lib/queries/orders";
import { cn } from "@/lib/utils";
import { ItemThumb } from "../order-cells";
import { CopyButton, NoteForm, RefundButton, ShippingForm } from "./forms";
import { OrderActionsBar, OrderActionsCard } from "./order-actions";

/**
 * Admin order detail (no design; derived from Order_Details.png's content and
 * the admin kit of Product List / Add Products / Dashboard: white 12-radius
 * cards, mint table header, StatusChip badges, 48-high fields).
 *
 * Laptop+: two columns (wide: header, items + totals, timeline | narrow:
 * actions, customer, addresses, payment, shipping). Below laptop: one column in
 * task order, with the primary action in a sticky bottom bar.
 */
export function AdminOrderDetailView({
  order,
  canUpdate,
  canRefund,
}: {
  order: AdminOrderDetail;
  canUpdate: boolean;
  canRefund: boolean;
}) {
  const actions = {
    order: {
      number: order.number,
      version: order.version,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      deliveredAt: order.deliveredAt,
      courier: order.courier,
      trackingNumber: order.trackingNumber,
    },
    couriers: order.settings.couriers,
    returnWindowDays: order.settings.returnWindowDays,
    canUpdate,
    hasEmail: emailKindFor(order.status) !== null,
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h1 text-foreground">Order {orderRef(order.number)}</h2>
        <Link
          href="/admin/orders"
          className="tap-target inline-flex items-center gap-1.5 text-lead font-medium text-primary hover:underline"
        >
          <ArrowLeftIcon aria-hidden className="size-4" /> Order List
        </Link>
      </div>

      {/* Below laptop the two columns dissolve (`contents`) and `order-*` sets the task order. */}
      <div className="flex flex-col gap-5 laptop:grid laptop:grid-cols-[minmax(0,1fr)_24rem] laptop:items-start">
        <div className="contents laptop:flex laptop:min-w-0 laptop:flex-col laptop:gap-5">
          <HeaderCard order={order} className="order-1" />
          <ItemsCard order={order} className="order-3" />
          <TimelineCard order={order} canUpdate={canUpdate} className="order-8" />
        </div>
        <div className="contents laptop:flex laptop:min-w-0 laptop:flex-col laptop:gap-5">
          <OrderActionsCard {...actions} />
          <CustomerCard order={order} className="order-2" />
          <AddressCard title="Shipping address" address={order.shipping} extra={shippingExtra(order)} className="order-4" />
          <AddressCard title="Billing address" address={order.billing} className="order-5" />
          <PaymentCard order={order} canRefund={canRefund} className="order-6" />
          <ShippingCard order={order} canUpdate={canUpdate} className="order-7" />
        </div>
      </div>

      <OrderActionsBar {...actions} />
    </div>
  );
}

// ───────────────────────────── building blocks ─────────────────────────────

const Card = DetailCard;
const Row = DetailRow;

const dateTime = (iso: string) => formatDhaka(iso, "dd MMM yyyy, h:mm a");

// ───────────────────────────── left column ─────────────────────────────

function HeaderCard({ order, className }: { order: AdminOrderDetail; className?: string }) {
  return (
    <section aria-label="Order summary" className={cn("min-w-0 rounded-xl bg-card p-4 tablet:p-6", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-caption tracking-wide text-muted-foreground uppercase">Order {order.orderNumber}</p>
          <p className="mt-1 text-h3 text-foreground">Placed {dateTime(order.createdAt)}</p>
          <p className="mt-1 text-copy text-text-body">
            {METHOD_LABELS[order.paymentMethod]} · {formatPrice(order.totalCents)}
            {order.deliveryEstimate && ` · ${order.shippingZoneName ?? "Delivery"} ${order.deliveryEstimate}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge variant="admin" status={order.status} paymentStatus={order.paymentStatus} method={order.paymentMethod} className="h-7 px-3 text-copy" />
          <PaymentStatusBadge paymentStatus={order.paymentStatus} method={order.paymentMethod} className="h-7 px-3 text-copy" />
        </div>
      </div>
      {order.codFlagged && (
        <p role="note" className="mt-4 flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-copy text-warning-strong">
          <ShieldAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            <span className="font-bold">Flagged phone.</span> {order.codFlagReason ? `${order.codFlagReason} on this phone.` : "This phone has earlier cancelled COD orders."} Call the
            customer before confirming.
          </span>
        </p>
      )}
      {order.status === "CANCELLED" && (
        <p role="note" className="mt-4 flex items-start gap-2 rounded-lg bg-sale-soft px-4 py-3 text-copy text-sale">
          <TriangleAlertIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            Cancelled{order.cancelledAt ? ` on ${dateTime(order.cancelledAt)}` : ""}
            {order.cancelReason ? `: ${order.cancelReason}` : "."}
            {order.paymentStatus === "PAID" && " The payment hasn't been refunded yet."}
          </span>
        </p>
      )}
      {order.notes && (
        <p className="mt-4 rounded-lg bg-muted px-4 py-3 text-copy text-text-body">
          <span className="font-medium text-foreground">Customer note:</span> {order.notes}
        </p>
      )}
    </section>
  );
}

function ItemsCard({ order, className }: { order: AdminOrderDetail; className?: string }) {
  const units = order.items.reduce((n, i) => n + i.quantity, 0);
  const usd = order.displayCurrency !== order.currency;
  const totals: [React.ReactNode, React.ReactNode, string?][] = [
    ["Subtotal", formatPrice(order.subtotalCents)],
    ...(order.discountCents > 0
      ? ([[order.couponCode ? `Discount (${order.couponCode})` : "Discount", `−${formatPrice(order.discountCents)}`, "text-sale"]] as [string, string, string][])
      : []),
    ["Shipping", order.shippingCents > 0 ? formatPrice(order.shippingCents) : "Free"],
    ...(order.codFeeCents > 0 ? ([["COD fee", formatPrice(order.codFeeCents)]] as [string, string][]) : []),
  ];

  return (
    <Card
      title={
        <>
          Items ({order.items.length}){units !== order.items.length && <span className="text-copy font-normal text-muted-foreground"> · {units} units</span>}
        </>
      }
      titleId="items-title"
      className={className}
    >
      {/* Laptop+: Product List table look. Below: stacked rows. */}
      <div className="-mx-4 overflow-x-auto tablet:mx-0">
        <table className="hidden w-full min-w-150 text-left text-copy text-foreground tablet:table">
          <thead className="bg-secondary">
            <tr className="h-12.5">
              <th scope="col" className="rounded-l-lg px-3 font-medium">
                Product
              </th>
              <th scope="col" className="px-3 font-medium">
                SKU
              </th>
              <th scope="col" className="px-3 text-right font-medium">
                Price
              </th>
              <th scope="col" className="px-3 text-center font-medium">
                Qty
              </th>
              <th scope="col" className="rounded-r-lg px-3 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {order.items.map((i) => (
              <tr key={i.id} className="h-17.5">
                <td className="px-3 py-2">
                  <span className="flex min-w-0 items-center gap-3">
                    <ItemThumb src={i.imageUrl} className="size-12" sizes="48px" />
                    <span className="min-w-0 leading-5">
                      <ProductName item={i} />
                      {i.variantName && <span className="block text-caption text-muted-foreground">{i.variantName}</span>}
                    </span>
                  </span>
                </td>
                <td className="px-3 text-text-body">{i.sku ?? "—"}</td>
                <td className="px-3 text-right tabular-nums">{formatPrice(i.unitPriceCents)}</td>
                <td className="px-3 text-center tabular-nums">×{i.quantity}</td>
                <td className="px-3 text-right font-medium tabular-nums">{formatPrice(i.subtotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col divide-y divide-border tablet:hidden">
        {order.items.map((i) => (
          <li key={i.id} className="flex gap-3 py-3 first:pt-0">
            <ItemThumb src={i.imageUrl} className="size-14" sizes="56px" />
            <div className="min-w-0 flex-1 text-copy">
              <ProductName item={i} />
              <p className="text-caption text-muted-foreground">
                {[i.variantName, i.sku].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 flex justify-between gap-3 tabular-nums">
                <span className="text-text-body">
                  {formatPrice(i.unitPriceCents)} × {i.quantity}
                </span>
                <span className="font-medium">{formatPrice(i.subtotalCents)}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-4 ml-auto flex w-full flex-col border-t border-border pt-2 tablet:max-w-90">
        {totals.map(([label, value, cls], idx) => (
          <Row key={idx} label={label}>
            <span className={cls}>{value}</span>
          </Row>
        ))}
        <Row label={<span className="text-h4 text-foreground">Total</span>} className="mt-1 border-t border-border pt-3">
          <span className="text-h4 font-semibold text-brand-dark tabular-nums">{formatPrice(order.totalCents)}</span>
        </Row>
        {usd && (
          <p className="text-right text-caption text-muted-foreground">
            Customer saw {order.displayCurrency} {(order.displayTotalCents / 100).toFixed(2)}; charged {formatPrice(order.totalCents)}.
          </p>
        )}
        {order.refundedCents > 0 && (
          <Row label="Refunded">
            <span className="text-sale tabular-nums">−{formatPrice(order.refundedCents)}</span>
          </Row>
        )}
      </dl>
    </Card>
  );
}

function ProductName({ item }: { item: AdminOrderDetail["items"][number] }) {
  if (!item.productId) return <span className="block font-medium">{item.productName}</span>;
  return (
    <Link href={`/admin/products/${item.productId}`} className="block font-medium hover:text-primary hover:underline">
      {item.productName}
    </Link>
  );
}

function TimelineCard({ order, canUpdate, className }: { order: AdminOrderDetail; canUpdate: boolean; className?: string }) {
  const events = [...order.timeline].reverse(); // newest first
  return (
    <Card title="Timeline" titleId="timeline-title" className={className}>
      <ol className="flex flex-col">
        {events.map((e, i) => (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
            {i < events.length - 1 && <span aria-hidden className="absolute top-4 bottom-0 left-1.75 w-px bg-border" />}
            <span
              aria-hidden
              className={cn("relative mt-1.5 size-3.5 shrink-0 rounded-full border-2", e.internal ? "border-info bg-card" : i === 0 ? "border-primary bg-primary" : "border-primary bg-card")}
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-copy font-medium text-foreground">
                {e.internal ? <StatusChip tone="info">Internal note</StatusChip> : e.status ? ADMIN_STATUS_LABELS[e.status] : "Update"}
              </p>
              {e.note && <p className="mt-0.5 text-copy break-words whitespace-pre-line text-text-body">{e.note}</p>}
              <p className="mt-0.5 text-caption text-muted-foreground">
                {dateTime(e.createdAt)} · {e.actorName ?? ACTOR[e.actor] ?? e.actor}
              </p>
            </div>
          </li>
        ))}
        {events.length === 0 && <li className="text-copy text-muted-foreground">No status history yet.</li>}
      </ol>
      {canUpdate && <NoteForm number={order.number} />}
    </Card>
  );
}

const ACTOR: Record<string, string> = { customer: "Customer", admin: "Staff", system: "System" };

// ───────────────────────────── right column ─────────────────────────────

function CustomerCard({ order, className }: { order: AdminOrderDetail; className?: string }) {
  const c = order.customer;
  return (
    <Card
      title="Customer"
      titleId="customer-title"
      className={className}
      action={
        c.userId ? (
          <Link href={`/admin/customers/${c.userId}`} className="tap-target inline-flex items-center gap-1 text-copy font-medium text-primary hover:underline">
            View customer <ExternalLinkIcon aria-hidden className="size-3.5" />
          </Link>
        ) : (
          <StatusChip tone="neutral">Guest</StatusChip>
        )
      }
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <UserRoundIcon aria-hidden className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-lead font-medium text-foreground">{c.name}</p>
          <p className="text-caption text-muted-foreground">
            {c.orderCount} order{c.orderCount === 1 ? "" : "s"}
            {c.isGuest ? " with this email" : ""}
          </p>
        </div>
      </div>
      <dl className="mt-3 flex flex-col divide-y divide-border">
        <div className="flex items-center justify-between gap-2 py-2 text-copy">
          <dt className="sr-only">Email</dt>
          <dd className="min-w-0 truncate">
            <a href={`mailto:${order.email}`} className="text-foreground hover:text-primary hover:underline">
              {order.email}
            </a>
          </dd>
          <CopyButton value={order.email} label="Copy email" />
        </div>
        <div className="flex items-center justify-between gap-2 py-2 text-copy">
          <dt className="sr-only">Phone</dt>
          <dd className="min-w-0">
            <a href={`tel:${order.phone}`} className="tap-target inline-flex items-center gap-1.5 text-foreground hover:text-primary hover:underline">
              <PhoneIcon aria-hidden className="size-4" /> {order.phone}
            </a>
          </dd>
          <CopyButton value={order.phone} label="Copy phone" />
        </div>
      </dl>
      <div className="mt-2 rounded-lg bg-muted px-3 py-2.5 text-copy">
        <p className={cn("font-medium", order.codCancellations.length ? "text-warning-strong" : "text-foreground")}>
          {order.codCancellations.length
            ? `${order.codCancellations.length} cancelled COD order${order.codCancellations.length === 1 ? "" : "s"} on this phone`
            : "No cancelled COD orders on this phone"}
        </p>
        {order.codCancellations.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5 text-caption text-text-body">
            {order.codCancellations.slice(0, 5).map((x) => (
              <li key={x.number}>
                <Link href={adminOrderHref(x.number)} className="font-medium text-foreground hover:underline">
                  {orderRef(x.number)}
                </Link>{" "}
                · {formatDhaka(x.createdAt, "dd MMM yyyy")}
                {x.reason ? ` · ${x.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function shippingExtra(order: AdminOrderDetail) {
  return order.district ? `District: ${order.district}${order.shippingZoneName ? ` (${order.shippingZoneName})` : ""}` : undefined;
}

function AddressCard({ title, address, extra, className }: { title: string; address: AddressSnapshot | null; extra?: string; className?: string }) {
  const id = title.toLowerCase().replace(/\W+/g, "-");
  const text = address ? [address.name, ...address.lines, address.phone].filter(Boolean).join("\n") : "";
  return (
    <Card title={title} titleId={id} className={className} action={address && <CopyButton value={text} label={`Copy ${title.toLowerCase()}`} />}>
      {address ? (
        <address className="flex flex-col gap-0.5 text-copy text-text-body not-italic">
          <span className="font-medium text-foreground">{address.name}</span>
          {address.lines.map((l) => (
            <span key={l}>{l}</span>
          ))}
          {address.phone && <span>{address.phone}</span>}
          {extra && <span className="mt-1 text-caption text-muted-foreground">{extra}</span>}
        </address>
      ) : (
        <p className="text-copy text-muted-foreground">Not available</p>
      )}
    </Card>
  );
}


function PaymentCard({ order, canRefund, className }: { order: AdminOrderDetail; canRefund: boolean; className?: string }) {
  const paid = order.payments.find((p) => p.status === "SUCCEEDED");
  const txn = paid?.trxId ?? paid?.bankTranId ?? null;
  const left = order.totalCents - order.refundedCents;
  return (
    <Card title="Payment" titleId="payment-title" className={className}>
      <dl className="flex flex-col divide-y divide-border">
        <Row label="Method">{METHOD_LABELS[order.paymentMethod]}</Row>
        <Row label="Status">
          <PaymentStatusBadge paymentStatus={order.paymentStatus} method={order.paymentMethod} />
        </Row>
        {order.paidAt && <Row label="Paid">{dateTime(order.paidAt)}</Row>}
        {txn && (
          <Row label="Transaction ID">
            <span className="font-mono text-caption break-all">{txn}</span>
          </Row>
        )}
        {order.refundedCents > 0 && <Row label="Refunded">{formatPrice(order.refundedCents)}</Row>}
      </dl>

      {order.payments.length > 0 && (
        <div className="mt-3">
          <h3 className="text-copy font-medium text-foreground">
            Attempts <span className="text-muted-foreground">({order.payments.length})</span>
          </h3>
          <ul className="mt-2 flex flex-col gap-2">
            {order.payments.map((p) => (
              <li key={p.id}>
                <details className="group rounded-lg border border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-copy [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">
                        #{p.attempt} · {METHOD_LABELS[p.method]}
                      </span>
                      <span className="block text-caption text-muted-foreground">{dateTime(p.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{formatPrice(p.amountCents)}</span>
                      <StatusChip tone={ATTEMPT_TONE[p.status]}>{ATTEMPT_LABEL[p.status]}</StatusChip>
                    </span>
                  </summary>
                  <dl className="flex flex-col border-t border-border px-3 py-2 text-caption">
                    <AttemptRow label="Reference" value={p.reference} />
                    <AttemptRow label="bKash paymentID" value={p.paymentId} />
                    <AttemptRow label="bKash trxID" value={p.trxId} />
                    <AttemptRow label="SSLCommerz val_id" value={p.valId} />
                    <AttemptRow label="Bank transaction" value={p.bankTranId} />
                    <AttemptRow label="Completed" value={p.completedAt ? dateTime(p.completedAt) : null} />
                    <AttemptRow label="Reason" value={p.failReason} />
                  </dl>
                  {p.raw !== null && (
                    <details className="border-t border-border px-3 py-2">
                      <summary className="cursor-pointer text-caption font-medium text-primary">Raw gateway log (admins only)</summary>
                      <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-muted p-2 text-caption break-all whitespace-pre-wrap text-text-body">
                        {JSON.stringify(p.raw, null, 2)}
                      </pre>
                    </details>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.refunds.length > 0 && (
        <div className="mt-3">
          <h3 className="text-copy font-medium text-foreground">Refunds</h3>
          <ul className="mt-1 flex flex-col gap-1 text-caption text-text-body">
            {order.refunds.map((r) => (
              <li key={r.id}>
                <span className="font-medium text-foreground">{formatPrice(r.amountCents)}</span> · {dateTime(r.createdAt)}
                {r.actorName ? ` · ${r.actorName}` : ""}
                {r.note && <span className="block">{r.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {canRefund && order.paymentStatus === "PAID" && left > 0 && (
        <div className="mt-4">
          <RefundButton number={order.number} version={order.version} leftCents={left} />
        </div>
      )}
    </Card>
  );
}

function AttemptRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-mono break-all text-foreground">{value}</dd>
    </div>
  );
}

function ShippingCard({ order, canUpdate, className }: { order: AdminOrderDetail; canUpdate: boolean; className?: string }) {
  const editable = canUpdate && (order.status === "PROCESSING" || order.status === "SHIPPED");
  return (
    <Card title="Shipping" titleId="shipping-title" className={className}>
      {!editable && (
        <dl className="flex flex-col divide-y divide-border">
          <Row label="Courier">{order.courier ?? "—"}</Row>
          <Row label="Tracking number">{order.trackingNumber ?? "—"}</Row>
          {order.trackingUrl && (
            <Row label="Tracking link">
              <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Open <ExternalLinkIcon aria-hidden className="size-3.5" />
              </a>
            </Row>
          )}
          {order.shippedAt && <Row label="Shipped">{dateTime(order.shippedAt)}</Row>}
          {order.deliveredAt && <Row label="Delivered">{dateTime(order.deliveredAt)}</Row>}
        </dl>
      )}
      {editable && (
        <>
          {order.status === "PROCESSING" && (
            <p className="text-copy text-text-body">Fill these in now or when you mark the order shipped.</p>
          )}
          {order.shippedAt && <p className="text-caption text-muted-foreground">Shipped {dateTime(order.shippedAt)}</p>}
          {order.trackingUrl && (
            <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-copy text-primary hover:underline">
              Open tracking page <ExternalLinkIcon aria-hidden className="size-3.5" />
            </a>
          )}
          <ShippingForm
            order={{ number: order.number, version: order.version, courier: order.courier, trackingNumber: order.trackingNumber, trackingUrl: order.trackingUrl }}
            couriers={order.settings.couriers}
          />
        </>
      )}
    </Card>
  );
}
