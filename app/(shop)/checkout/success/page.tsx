import { CheckCircle2Icon, ClockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { PageTransition } from "@/components/shared/page-transition";
import { OrderResultDetails } from "@/components/shop/checkout/order-result";
import { RetryPayment } from "@/components/shop/checkout/retry-payment";
import { PageHero } from "@/components/shop/page-hero";
import { Skeleton } from "@/components/ui/skeleton";
import { methodAvailability } from "@/lib/checkout/pricing";
import { resultCopy } from "@/lib/config/checkout";
import { formatPrice } from "@/lib/money";
import { getCheckoutOrder } from "@/lib/queries/checkout-order";
import { getStoreSettings } from "@/lib/queries/settings";

/**
 * After checkout: paid (bKash / SSLCommerz), placed (COD), or still confirming
 * (the gateway redirect beat the payment confirmation). Read-only, so a refresh
 * is safe; never indexed.
 */
export const metadata: Metadata = {
  title: "Order confirmed",
  robots: { index: false, follow: false },
};

export default function CheckoutSuccessPage({ searchParams }: PageProps<"/checkout/success">) {
  return (
    <PageTransition>
      <PageHero crumbs={[{ label: "Home", href: "/" }, { label: "Order confirmation" }]} />
      <Container className="pt-6 pb-section tablet:pt-8 laptop:pt-10 laptop:pb-20">
        <div className="mx-auto max-w-3xl">
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          <SuccessSection searchParams={searchParams} />
        </Suspense>
        </div>
      </Container>
    </PageTransition>
  );
}

async function SuccessSection({ searchParams }: Pick<PageProps<"/checkout/success">, "searchParams">) {
  const { id } = await searchParams;
  const order = await getCheckoutOrder(typeof id === "string" ? id : undefined);
  if (!order) notFound();
  if (["FAILED", "CANCELLED", "EXPIRED"].includes(order.status)) {
    redirect(`/checkout/failed?id=${order.id}&reason=${order.status.toLowerCase()}`);
  }

  const paid = order.paymentStatus === "PAID";
  const cod = order.paymentMethod === "COD";
  const waiting = !paid && !cod; // PENDING_PAYMENT: confirmation not in yet

  let retry = null;
  if (waiting) {
    const settings = await getStoreSettings();
    const payable = order.totalCents - order.codFeeCents;
    retry = {
      quote: {
        subtotalCents: order.subtotalCents,
        discountCents: order.discountCents,
        couponCode: order.couponCode,
        shippingCents: order.shippingCents,
        zone: null,
        codFeeCents: order.codFeeCents,
        totalCents: order.totalCents,
        district: order.district,
        paymentMethod: order.paymentMethod,
        methods: methodAvailability(settings, order.district, payable),
      },
      codFeeCents: settings.codFeeCents,
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {waiting ? (
          <ClockIcon aria-hidden className="size-14 text-warning" />
        ) : (
          <CheckCircle2Icon aria-hidden className="size-14 text-primary" />
        )}
        <h1 className="text-h2 font-medium text-foreground">
          {waiting ? resultCopy.pendingTitle : cod ? resultCopy.codTitle : resultCopy.successTitle}
        </h1>
        {waiting && <p className="text-copy text-text-body">{resultCopy.pendingBody}</p>}
        {cod && !paid && (
          <p className="rounded-md bg-secondary px-4 py-3 text-copy font-medium text-brand-dark">
            {resultCopy.codPay(formatPrice(order.totalCents))}
          </p>
        )}
      </div>

      <OrderResultDetails order={order} />

      {retry && (
        <RetryPayment
          orderId={order.id}
          method={order.paymentMethod}
          quote={retry.quote}
          codFeeCents={retry.codFeeCents}
        />
      )}

      <div className="flex flex-col gap-3 tablet:flex-row tablet:justify-center">
        <Link
          href="/shop"
          className="press inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-copy font-semibold text-primary-foreground hover:bg-brand-dark"
        >
          {resultCopy.continueShopping}
        </Link>
        {order.userId && (
          <Link
            href={`/account/orders/${order.number}`}
            className="press inline-flex h-12 items-center justify-center rounded-full border border-primary px-8 text-copy font-semibold text-primary hover:bg-secondary"
          >
            {resultCopy.viewOrder}
          </Link>
        )}
      </div>
    </div>
  );
}
