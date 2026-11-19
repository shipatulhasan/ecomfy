import { LogoMark } from "@/components/shared/logo";
import { phoneLabel } from "@/lib/checkout/settings";
import { getStoreSettings } from "@/lib/queries/settings";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";
import { formatPrice } from "@/lib/money";
import { formatOrderDate } from "@/lib/orders/format";
import { orderStatusView, paymentMethodLabel, paymentStatusView } from "@/lib/orders/status";
import type { AddressSnapshot } from "@/lib/queries/orders";
import { cn } from "@/lib/utils";

/**
 * The one invoice template: the customer's "Download invoice" page and the admin
 * print routes (one order, or several merged with a page break between them)
 * render this. A4 print styles live in app/globals.css → Printing. Amounts are
 * the charged BDT amounts.
 */
export type InvoiceData = {
  number: number;
  orderNumber: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  transactionId: string | null;
  billing: AddressSnapshot | null;
  shipping: AddressSnapshot | null;
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  shippingCents: number;
  codFeeCents: number;
  totalCents: number;
  items: { id: string; productName: string; variantName: string; unitPriceCents: number; quantity: number; subtotalCents: number }[];
};

export async function InvoiceSheet({ order, className }: { order: InvoiceData; className?: string }) {
  // Admin Settings → Store (name, address, phone, email).
  const { store } = await getStoreSettings();
  const contact = `${phoneLabel(store.contactPhone)} · ${store.contactEmail}`;
  const status = orderStatusView(order.status, order.paymentStatus, order.paymentMethod);
  const payment = paymentStatusView(order.paymentMethod, order.paymentStatus);
  const totals: [string, string][] = [
    ["Subtotal", formatPrice(order.subtotalCents)],
    ...(order.discountCents > 0
      ? ([[order.couponCode ? `Discount (${order.couponCode})` : "Discount", `−${formatPrice(order.discountCents)}`]] as [string, string][])
      : []),
    ["Shipping", order.shippingCents > 0 ? formatPrice(order.shippingCents) : "Free"],
    ...(order.codFeeCents > 0 ? ([["Cash on Delivery fee", formatPrice(order.codFeeCents)]] as [string, string][]) : []),
  ];

  return (
    <article
      className={cn(
        "flex flex-col gap-8 rounded-lg border border-border bg-card p-8 text-copy text-text-body print:rounded-none print:border-0 print:p-0",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-primary pb-6">
        <div className="flex flex-col gap-2">
          <span className="inline-flex items-center gap-2">
            <LogoMark className="h-8 w-auto" />
            <span className="text-h2 font-medium tracking-tight text-brand-ink">{store.name}</span>
          </span>
          <p className="text-caption">{store.address}</p>
          <p className="text-caption">{contact}</p>
        </div>
        <div className="flex flex-col items-end gap-1 text-right">
          <h1 className="text-h2 font-semibold text-brand-dark">Invoice</h1>
          <p>
            <span className="text-text-subtle">Order </span>
            <span className="font-medium text-foreground">#{order.number}</span>
          </p>
          <p className="text-caption text-text-subtle">{order.orderNumber}</p>
          <p>
            <span className="text-text-subtle">Date </span>
            <span className="text-foreground">{formatOrderDate(order.createdAt)}</span>
          </p>
        </div>
      </header>

      <section className="grid gap-6 tablet:grid-cols-3 print:grid-cols-3">
        <InvoiceAddress title="Bill to" address={order.billing} />
        <InvoiceAddress title="Ship to" address={order.shipping ?? order.billing} />
        <div className="flex flex-col gap-1">
          <h2 className="text-caption font-medium tracking-wide text-muted-foreground uppercase">Payment</h2>
          <p className="text-foreground">{paymentMethodLabel(order.paymentMethod)}</p>
          <p>{payment.label}</p>
          {order.transactionId && <p className="font-mono text-caption break-all">Txn: {order.transactionId}</p>}
          <p className="text-caption">Order status: {status.label}</p>
        </div>
      </section>

      <table className="w-full text-left">
        <thead className="bg-secondary text-caption font-medium tracking-wide text-brand-dark uppercase">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Product
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Price
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Qty
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-border">
          {order.items.map((i) => (
            <tr key={i.id} className="break-inside-avoid">
              <td className="px-3 py-2.5">
                <span className="block text-foreground">{i.productName}</span>
                <span className="text-caption text-text-subtle">{i.variantName}</span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{formatPrice(i.unitPriceCents)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{i.quantity}</td>
              <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{formatPrice(i.subtotalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="ml-auto flex w-full max-w-xs flex-col gap-2 break-inside-avoid">
        {totals.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt>{label}</dt>
            <dd className="text-foreground tabular-nums">{value}</dd>
          </div>
        ))}
        <div className="mt-1 flex justify-between gap-4 border-t-2 border-primary pt-3 text-h4">
          <dt className="text-foreground">Total</dt>
          <dd className="font-semibold text-brand-dark tabular-nums">{formatPrice(order.totalCents)}</dd>
        </div>
      </dl>

      <footer className="border-t border-border pt-4 text-center text-caption text-text-subtle">
        Thank you for shopping with {store.name}. Questions? {contact}
      </footer>
    </article>
  );
}

function InvoiceAddress({ title, address }: { title: string; address: AddressSnapshot | null }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-caption font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {address ? (
        <>
          <p className="text-foreground">{address.name}</p>
          {address.lines.map((l) => (
            <p key={l}>{l}</p>
          ))}
          {address.phone && <p>{address.phone}</p>}
          {address.email && <p className="break-all">{address.email}</p>}
        </>
      ) : (
        <p>Not available</p>
      )}
    </div>
  );
}
