import { XCircleIcon } from "lucide-react";
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
import { retryQuote } from "@/lib/checkout/pricing";
import { resultCopy } from "@/lib/config/checkout";
import { getCheckoutOrder } from "@/lib/queries/checkout-order";
import { getStoreSettings } from "@/lib/queries/settings";

/**
 * Payment failed / cancelled / expired. Stock was released and the cart kept;
 * "Try again" or "Change method" starts a new attempt on the SAME order.
 */
export const metadata: Metadata = {
  title: "Payment not completed",
  robots: { index: false, follow: false },
};

export default function CheckoutFailedPage({ searchParams }: PageProps<"/checkout/failed">) {
  return (
    <PageTransition>
      <PageHero crumbs={[{ label: "Home", href: "/" }, { label: "Checkout", href: "/checkout" }, { label: "Payment" }]} />
      <Container className="pt-6 pb-section tablet:pt-8 laptop:pt-10 laptop:pb-20">
        <div className="mx-auto max-w-3xl">
        <Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
          <FailedSection searchParams={searchParams} />
        </Suspense>
        </div>
      </Container>
    </PageTransition>
  );
}

async function FailedSection({ searchParams }: Pick<PageProps<"/checkout/failed">, "searchParams">) {
  const { id, reason } = await searchParams;
  if (!id) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <XCircleIcon aria-hidden className="size-14 text-sale" />
        <h1 className="text-h2 font-medium text-foreground">{resultCopy.failedTitle}</h1>
        <Link href="/cart" className="press inline-flex h-12 items-center rounded-full bg-primary px-8 text-copy font-semibold text-primary-foreground">
          {resultCopy.backToCart}
        </Link>
      </div>
    );
  }
  const order = await getCheckoutOrder(typeof id === "string" ? id : undefined);
  if (!order) notFound();
  // Paid (e.g. the IPN won) or COD placed: this isn't a failure.
  if (order.paymentStatus === "PAID" || order.status === "PENDING_CONFIRMATION" || order.status === "PROCESSING") {
    redirect(`/checkout/success?id=${order.id}`);
  }

  const settings = await getStoreSettings();
  const quote = retryQuote(order, settings);

  const title =
    order.status === "EXPIRED"
      ? resultCopy.expiredTitle
      : order.status === "CANCELLED" || reason === "cancelled"
        ? resultCopy.cancelledTitle
        : resultCopy.failedTitle;
  const detail = order.payments[0]?.failReason;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <XCircleIcon aria-hidden className="size-14 text-sale" />
        <h1 className="text-h2 font-medium text-foreground">{title}</h1>
        <p className="max-w-prose text-copy text-text-body">
          {detail && <span className="block font-medium text-foreground">{detail}.</span>}
          {resultCopy.failedBody}
        </p>
      </div>

      <RetryPayment orderId={order.id} method={order.paymentMethod} quote={quote} codFeeCents={settings.codFeeCents} />

      <OrderResultDetails order={order} />

      <Link href="/cart" className="press tap-target self-center text-copy font-semibold text-primary hover:underline">
        {resultCopy.backToCart}
      </Link>
    </div>
  );
}
