import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderStatusBadge } from "@/components/shared/order-status-badge";
import { PageTransition } from "@/components/shared/page-transition";
import { OrderActionsBar, OrderActionsRow, type OrderActionsProps } from "@/components/shop/account/order-actions";
import {
  AddressesBox,
  OrderItemsList,
  OrderItemsTable,
  OrderProgressTracker,
  OrderProgressVertical,
  OrderStatusBanner,
  SummaryBox,
} from "@/components/shop/account/order-detail";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth-guards";
import { retryQuote } from "@/lib/checkout/pricing";
import { formatOrderDateLong, productCount } from "@/lib/orders/format";
import { orderProgressStep } from "@/lib/orders/status";
import { getUserOrder } from "@/lib/queries/orders";
import { getStoreSettings } from "@/lib/queries/settings";
import { orderNumberSchema } from "@/lib/validations/orders";

/**
 * Order Details (designs/screens/web/Order_Details.png).
 *
 * - Laptop+ is the PNG: header, addresses | summary, tracker (or status banner),
 *   products table, plus an actions row (derived).
 * - Below laptop it's an app screen: "Order #N" + status, vertical tracker,
 *   collapsible Addresses / Payment sections, stacked products, sticky actions.
 *
 * 404 unless the order belongs to the signed-in user: getUserOrder is scoped by
 * userId, so another customer's order looks exactly like a missing one.
 */
export async function generateMetadata({ params }: PageProps<"/account/orders/[orderNumber]">): Promise<Metadata> {
  const parsed = orderNumberSchema.safeParse((await params).orderNumber);
  return { title: parsed.success ? `Order #${parsed.data}` : "Order" };
}

export default function OrderDetailPage({ params }: PageProps<"/account/orders/[orderNumber]">) {
  return (
    <PageTransition>
      <Suspense fallback={<OrderDetailSkeleton />}>
        <OrderDetailSection params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function OrderDetailSection({ params }: { params: PageProps<"/account/orders/[orderNumber]">["params"] }) {
  const user = await requireUser();
  const parsed = orderNumberSchema.safeParse((await params).orderNumber);
  if (!parsed.success) notFound();
  const order = await getUserOrder(user.id, parsed.data);
  if (!order) notFound();

  const settings = order.actions.payNow ? await getStoreSettings() : null;
  const actions: OrderActionsProps = {
    number: order.number,
    allowed: order.actions,
    retry: settings
      ? { orderId: order.id, method: order.paymentMethod, quote: retryQuote(order, settings), codFeeCents: settings.codFeeCents }
      : null,
  };
  const subtitle = (
    <>
      {formatOrderDateLong(order.createdAt)} <span aria-hidden>•</span> {productCount(order.items.length)}
    </>
  );

  return (
    <article aria-labelledby="order-title" className="laptop:rounded-lg laptop:border laptop:border-border laptop:bg-card">
      {/* Header: PNG on laptop; "Order #N" + status below (the app bar has the back chevron). */}
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 pb-4 laptop:border-b laptop:border-border laptop:px-6 laptop:py-4">
        <div className="flex min-w-0 flex-col gap-1 laptop:flex-row laptop:flex-wrap laptop:items-baseline laptop:gap-x-2">
          <h1 id="order-title" className="text-h3 text-foreground laptop:text-h4 laptop:font-medium">
            <span className="laptop:hidden">Order #{order.number}</span>
            <span className="hidden laptop:inline">Order Details</span>
          </h1>
          <p className="text-copy text-text-body">
            <span aria-hidden className="hidden laptop:inline">• </span>
            {subtitle}
          </p>
        </div>
        <OrderStatusBadge
          status={order.status}
          paymentStatus={order.paymentStatus}
          method={order.paymentMethod}
          className="laptop:hidden"
        />
        <Link
          href="/account/orders"
          transitionTypes={["nav-back"]}
          className="hidden text-lead font-medium text-primary hover:text-brand-dark hover:underline laptop:inline"
        >
          Back to List
        </Link>
      </header>

      {/* ── Laptop+ (PNG) ── */}
      <div className="hidden flex-col gap-9 px-6 pt-6 laptop:flex">
        <div className="grid grid-cols-[624fr_288fr] gap-6">
          <AddressesBox billing={order.billing} shipping={order.shipping} />
          <SummaryBox order={order} />
        </div>
        <OrderProgressTracker order={order} className="px-9" />
        <OrderStatusBanner order={order} />
      </div>
      <div className="mt-10 hidden flex-col gap-6 pb-6 laptop:flex">
        <h2 className="sr-only">Products</h2>
        <OrderItemsTable order={order} />
        <OrderActionsRow {...actions} className="px-6" />
      </div>

      {/* ── Below laptop (app) ── */}
      <div className="flex flex-col gap-4 laptop:hidden">
        <OrderStatusBanner order={order} />
        {orderProgressStep(order.status) !== null && (
          <section aria-label="Order progress" className="rounded-lg border border-border bg-card p-4">
            <OrderProgressVertical order={order} />
          </section>
        )}
        <Accordion type="multiple" className="rounded-lg border border-border bg-card px-4">
          <AccordionItem value="addresses">
            <AccordionTrigger className="text-lead text-foreground">Addresses</AccordionTrigger>
            <AccordionContent>
              <AddressesBox billing={order.billing} shipping={order.shipping} />
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="payment">
            <AccordionTrigger className="text-lead text-foreground">Payment &amp; summary</AccordionTrigger>
            <AccordionContent>
              <SummaryBox order={order} />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <section aria-labelledby="m-products" className="rounded-lg border border-border bg-card px-4 pt-3">
          <h2 id="m-products" className="text-lead font-medium text-foreground">
            Products ({order.items.length})
          </h2>
          <OrderItemsList order={order} />
        </section>
        <OrderActionsBar {...actions} />
      </div>
    </article>
  );
}

function OrderDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading order" className="flex flex-col gap-6 laptop:rounded-lg laptop:border laptop:border-border laptop:p-6">
      <Skeleton className="h-7 w-72" />
      <div className="hidden grid-cols-[624fr_288fr] gap-6 laptop:grid">
        <Skeleton className="h-70 rounded-md" />
        <Skeleton className="h-70 rounded-md" />
      </div>
      <Skeleton className="hidden h-16 laptop:block" />
      <Skeleton className="h-56 rounded-lg laptop:hidden" />
      <Skeleton className="h-28 rounded-lg laptop:hidden" />
      <Skeleton className="h-56" />
    </div>
  );
}
