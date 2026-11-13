import Image from "next/image";
import { Money } from "@/components/shared/money";
import { checkoutCopy, paymentMethodMeta, resultCopy } from "@/lib/config/checkout";
import type { CheckoutOrder } from "@/lib/queries/checkout-order";
import { formatPrice } from "@/lib/money";

/** Order lines + totals shown on /checkout/success and /checkout/failed. */
export function OrderResultDetails({ order }: { order: CheckoutOrder }) {
  const payment = order.payments[0];
  const txn = payment?.trxId ?? payment?.bankTranId ?? null;
  const row = "flex items-center justify-between gap-3 py-2.5 text-copy";
  return (
    <div className="rounded-lg border border-border bg-card p-4 tablet:p-6">
      <dl className="grid gap-3 border-b border-border pb-4 text-copy tablet:grid-cols-2">
        <div>
          <dt className="text-caption text-muted-foreground">{resultCopy.orderNumber}</dt>
          <dd className="font-semibold text-foreground">{order.orderNumber}</dd>
        </div>
        <div>
          <dt className="text-caption text-muted-foreground">{resultCopy.method}</dt>
          <dd className="font-medium text-foreground">{paymentMethodMeta[order.paymentMethod].label}</dd>
        </div>
        {order.paymentStatus === "PAID" && txn && (
          <div>
            <dt className="text-caption text-muted-foreground">{resultCopy.transaction}</dt>
            <dd className="font-medium break-all text-foreground">{txn}</dd>
          </div>
        )}
        {order.deliveryEstimate && (
          <div>
            <dt className="text-caption text-muted-foreground">{resultCopy.delivery}</dt>
            <dd className="font-medium text-foreground">
              {order.deliveryEstimate}
              {order.shippingZoneName && <span className="text-muted-foreground"> · {order.shippingZoneName}</span>}
            </dd>
          </div>
        )}
      </dl>

      <ul className="divide-y divide-border">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <div className="relative size-15 shrink-0">
              {i.imageUrl && <Image src={i.imageUrl} alt={i.productName} fill sizes="60px" className="object-contain" />}
            </div>
            <p className="min-w-0 flex-1 text-copy text-foreground">
              {i.productName}
              <span className="ml-1.5 text-muted-foreground">
                {i.variantName} x{i.quantity}
              </span>
            </p>
            <Money cents={i.subtotalCents} className="text-copy font-medium" />
          </li>
        ))}
      </ul>

      <dl className="border-t border-border pt-2">
        <div className={row}>
          <dt className="text-text-body">{checkoutCopy.subtotal}</dt>
          <dd><Money cents={order.subtotalCents} /></dd>
        </div>
        {order.discountCents > 0 && (
          <div className={row}>
            <dt className="text-text-body">{checkoutCopy.discount(order.couponCode ?? "")}</dt>
            <dd className="text-primary">−<Money cents={order.discountCents} /></dd>
          </div>
        )}
        <div className={row}>
          <dt className="text-text-body">{checkoutCopy.shipping}</dt>
          <dd>{order.shippingCents === 0 ? checkoutCopy.free : <Money cents={order.shippingCents} />}</dd>
        </div>
        {order.codFeeCents > 0 && (
          <div className={row}>
            <dt className="text-text-body">{checkoutCopy.codFee}</dt>
            <dd><Money cents={order.codFeeCents} /></dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 pt-3 text-lead">
          <dt className="text-text-body">{resultCopy.total}</dt>
          <dd className="font-semibold text-foreground">
            <Money cents={order.totalCents} />
          </dd>
        </div>
        {/* Only while USD is displayed (CSS keyed on html[data-currency]). */}
        <p data-cur="USD" className="pt-1 text-right text-caption text-muted-foreground">
          {checkoutCopy.chargedIn(formatPrice(order.totalCents))}
        </p>
      </dl>
    </div>
  );
}
