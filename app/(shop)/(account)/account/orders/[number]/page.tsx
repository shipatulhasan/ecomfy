import { format } from "date-fns";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageTransition } from "@/components/shared/page-transition";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AddressesBox,
  OrderItemsTable,
  OrderProgressTracker,
  SummaryBox,
} from "@/components/shop/account/order-detail";
import { productCount } from "@/components/shop/account/orders-list";
import { requireUser } from "@/lib/auth-guards";
import { getOrderDetail } from "@/lib/queries/account";

/**
 * Order Details (designs/screens/web/Order_Details.png). 404 unless the order
 * belongs to the signed-in user (getOrderDetail is scoped by userId).
 */
export async function generateMetadata({ params }: PageProps<"/account/orders/[number]">): Promise<Metadata> {
  const { number } = await params;
  return { title: `Order #${number.replace(/\D/g, "").slice(0, 12)}` };
}

export default function OrderDetailPage({ params }: PageProps<"/account/orders/[number]">) {
  return (
    <PageTransition>
      <Suspense fallback={<OrderDetailSkeleton />}>
        <OrderDetailSection params={params} />
      </Suspense>
    </PageTransition>
  );
}

async function OrderDetailSection({ params }: { params: PageProps<"/account/orders/[number]">["params"] }) {
  const user = await requireUser();
  const { number } = await params;
  if (!/^\d{1,9}$/.test(number)) notFound();
  const order = await getOrderDetail(user.id, Number(number));
  if (!order) notFound();

  return (
    <article aria-labelledby="order-title" className="laptop:rounded-lg laptop:border laptop:border-border laptop:bg-card">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 pb-4 laptop:border-b laptop:border-border laptop:px-6 laptop:py-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h1 id="order-title" className="text-h3 text-foreground laptop:text-h4 laptop:font-medium">
            <span className="laptop:hidden">Order #{order.number}</span>
            <span className="hidden laptop:inline">Order Details</span>
          </h1>
          <p className="text-copy text-text-body">
            <span aria-hidden className="hidden laptop:inline">• </span>
            {format(order.createdAt, "MMMM d, yyyy")} <span aria-hidden>•</span> {productCount(order.items.length)}
          </p>
        </div>
        <Link
          href="/account/orders"
          transitionTypes={["nav-back"]}
          className="hidden text-lead font-medium text-primary hover:text-brand-dark hover:underline laptop:inline"
        >
          Back to List
        </Link>
      </header>

      <div className="flex flex-col gap-6 laptop:gap-9 laptop:px-6 laptop:pt-6">
        <div className="grid gap-4 laptop:grid-cols-[624fr_288fr] laptop:gap-6">
          <AddressesBox billing={order.billing} shipping={order.shipping} />
          <SummaryBox order={order} />
        </div>
        <div className="laptop:px-9">
          <OrderProgressTracker order={order} />
        </div>
      </div>

      <div className="mt-8 laptop:mt-10 laptop:pb-6">
        <h2 className="sr-only">Products</h2>
        <OrderItemsTable order={order} />
      </div>
    </article>
  );
}

function OrderDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading order" className="flex flex-col gap-6 laptop:rounded-lg laptop:border laptop:border-border laptop:p-6">
      <Skeleton className="h-7 w-72" />
      <div className="grid gap-4 laptop:grid-cols-[624fr_288fr] laptop:gap-6">
        <Skeleton className="h-60 rounded-md laptop:h-70" />
        <Skeleton className="h-60 rounded-md laptop:h-70" />
      </div>
      <Skeleton className="h-16" />
      <Skeleton className="h-56" />
    </div>
  );
}
