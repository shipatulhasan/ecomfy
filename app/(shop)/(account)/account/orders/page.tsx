import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageTransition } from "@/components/shared/page-transition";
import { OrdersSkeleton } from "@/components/shop/account/dashboard";
import { NoOrders, OrderCards, OrdersTable } from "@/components/shop/account/orders-list";
import { LoadMoreOrders, OrdersPagination } from "@/components/shop/account/orders-pagination";
import { requireUser } from "@/lib/auth-guards";
import { getUserOrders } from "@/lib/queries/orders";
import { ordersSearchSchema } from "@/lib/validations/orders";

/**
 * Order History (designs/screens/web/Order_History.png).
 * - Laptop+: the 984-wide card, title, table (12 rows), numbered pagination.
 * - Below laptop: one card per order and "Load more" (?page=N renders pages 1..N).
 * Per-user, request-time (never cached); noindex via the account layout.
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
        <Suspense fallback={<OrdersSkeleton rows={12} bare />}>
          <Orders searchParams={searchParams} />
        </Suspense>
      </section>
    </PageTransition>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/account/orders">["searchParams"] }) {
  const user = await requireUser();
  const raw = (await searchParams).page;
  const { page } = ordersSearchSchema.parse({ page: Array.isArray(raw) ? raw[0] : raw });
  const result = await getUserOrders(user.id, { page });
  if (result.outOfRange) redirect(result.pages <= 1 ? "/account/orders" : `/account/orders?page=${result.pages}`);
  if (result.total === 0) return <NoOrders className="rounded-lg border border-border laptop:border-0" />;

  return (
    <>
      <div className="hidden flex-col gap-6 laptop:flex">
        <OrdersTable rows={result.rows} />
        <OrdersPagination page={result.page} pages={result.pages} />
      </div>
      <div className="flex flex-col gap-4 laptop:hidden">
        <OrderCards rows={result.cards} />
        <LoadMoreOrders page={result.page} pages={result.pages} shown={result.cards.length} total={result.total} />
      </div>
    </>
  );
}
