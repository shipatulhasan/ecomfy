import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LogoMark } from "@/components/shared/logo";
import { PrintButton } from "@/components/shop/invoice/print-button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth-guards";
import { siteConfig } from "@/lib/config/site";
import { formatPrice } from "@/lib/money";
import { formatOrderDate } from "@/lib/orders/format";
import { orderStatusView, paymentStatusView } from "@/lib/orders/status";
import { getUserOrder, type AddressSnapshot } from "@/lib/queries/orders";
import { orderNumberSchema } from "@/lib/validations/orders";

/**
 * Printable invoice for one of the signed-in customer's orders ("Download invoice"
 * on Order Details). Plain HTML styled with the brand tokens and an A4 print sheet
 * (app/globals.css → Printing): the customer saves it with "Save as PDF".
 *
 * Its own route group: no storefront chrome. Same ownership rule as the details
 * page (another customer's order → 404). Amounts are the charged BDT amounts.
 */
export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export default function InvoicePage({ params, searchParams }: PageProps<"/account/orders/[orderNumber]/invoice">) {
  return (
    <main className="mx-auto w-full max-w-3xl bg-background px-gutter py-8 print:max-w-none print:p-0">
      <Suspense fallback={<Skeleton className="h-200 rounded-lg" />}>
        <Invoice params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Invoice({ params, searchParams }: Pick<PageProps<"/account/orders/[orderNumber]/invoice">, "params" | "searchParams">) {
  const user = await requireUser();
  const parsed = orderNumberSchema.safeParse((await params).orderNumber);
  if (!parsed.success) notFound();
  const order = await getUserOrder(user.id, parsed.data);
  if (!order) notFound();
  const autoPrint = (await searchParams).print === "1";

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
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/account/orders/${order.number}`} className="tap-target text-copy font-medium text-primary hover:underline">
          ← Back to order
        </Link>
        <PrintButton auto={autoPrint} />
      </div>

      <article className="flex flex-col gap-8 rounded-lg border border-border bg-card p-8 text-copy text-text-body print:rounded-none print:border-0 print:p-0">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-primary pb-6">
          <div className="flex flex-col gap-2">
            <span className="inline-flex items-center gap-2">
              <LogoMark className="h-8 w-auto" />
              <span className="text-h2 font-medium tracking-tight text-brand-ink">{siteConfig.name}</span>
            </span>
            <p className="text-caption">{siteConfig.storeLocation.replace(/^Store Location:\s*/, "")}</p>
            <p className="text-caption">
              {siteConfig.phone.label} · {siteConfig.email.label}
            </p>
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
            <p className="text-foreground">{order.paymentMethodLabel}</p>
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
          Thank you for shopping with {siteConfig.name}. Questions? {siteConfig.phone.label} · {siteConfig.email.label}
        </footer>
      </article>
    </>
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
