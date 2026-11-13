import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/shared/page-transition";
import { OrdersSkeleton } from "@/components/shop/account/dashboard";
import { NoOrders, OrderCards, OrdersTable } from "@/components/shop/account/orders-list";
import { OrdersPagination } from "@/components/shop/account/orders-pagination";
import { requireUser } from "@/lib/auth-guards";
import { getOrdersPage } from "@/lib/queries/account";

/**
 * Order History (designs/screens/web/Order_History.png): 984-wide card, title,
 * table (12 rows), pagination. Tablet: the table scrolls inside the card. Phones:
 * one card per order.
 */
export const metadata: Metadata = { title: "Order History" };

export default function OrderHistoryPage({ searchParams }: PageProps<"/account/orders">) {
  return (
    <PageTransition>
      <section
        aria-labelledby="orders-title"
        className="laptop:rounded-lg laptop:border laptop:border-border laptop:bg-card laptop:pb-8"
      >
        <h1 id="orders-title" className="pb-4 text-h3 text-foreground laptop:px-6 laptop:pt-4 laptop:text-h4 laptop:font-medium">
          Order History
        </h1>
        <Suspense fallback={<OrdersSkeleton rows={12} />}>
          <Orders searchParams={searchParams} />
        </Suspense>
      </section>
    </PageTransition>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/account/orders">["searchParams"] }) {
  const user = await requireUser();
  const raw = (await searchParams).page;
  const { rows, page, pages } = await getOrdersPage(user.id, Number(Array.isArray(raw) ? raw[0] : raw) || 1);
  if (rows.length === 0) return <NoOrders className="rounded-lg border border-border laptop:border-0" />;
  return (
    <div className="flex flex-col gap-6">
      <div className="hidden overflow-x-auto rounded-lg border border-border tablet:block laptop:rounded-none laptop:border-0">
        <OrdersTable rows={rows} className="min-w-200 laptop:min-w-0" />
      </div>
      <OrderCards rows={rows} className="tablet:hidden" />
      <OrdersPagination page={page} pages={pages} />
    </div>
  );
}
