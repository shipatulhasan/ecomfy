import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrderHeaderActions } from "@/components/admin/orders/list/header-actions";
import { OrderKpiCards, OrderKpiSkeleton } from "@/components/admin/orders/list/kpi-cards";
import { NewOrdersPill } from "@/components/admin/orders/list/new-orders-pill";
import { OrderListView } from "@/components/admin/orders/list/order-list-view";
import { OrderListSkeleton, OrderRowsSkeleton } from "@/components/admin/orders/list/skeletons";
import { OrderListToolbar } from "@/components/admin/orders/list/toolbar";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { orderParamsHref, parseOrderParams, type OrderListParams } from "@/lib/admin/orders/params";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getCourierOptions, getOrderTabCounts, listAdminOrders } from "@/lib/queries/admin/orders";
import { getStoreSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Order Management", robots: { index: false, follow: false } };

/**
 * Order Management (designs/screens/admin/Order Management.png): the four
 * counters, then the "Order List" card (tabs, search, filters, table, pager).
 * All list state lives in the URL (?tab=&q=&status=&method=&payment=&from=&to=
 * &district=&flagged=&sort=&page=) and runs on the server; the rows stream in
 * behind a skeleton. Rows carry customer PII: request-time only, never cached.
 * Deliberate changes from the PNG are listed in designs/DESIGN.md.
 */
export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<OrderListSkeleton />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/admin/orders">, "searchParams">) {
  const user = await requireStaff("/admin/orders");
  if (!can(user, "orders:read")) return <Forbidden />;
  const params = parseOrderParams(await searchParams);
  const counts = await getOrderTabCounts(params);
  const renderedAt = new Date().toISOString();

  return (
    <Container variant="admin" className="flex flex-col gap-6 py-5">
      <Suspense fallback={<OrderKpiSkeleton />}>
        <OrderKpiCards />
      </Suspense>

      <section aria-labelledby="order-list-title" className="rounded-xl bg-card p-4 tablet:p-6">
        <NewOrdersPill since={renderedAt} />
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 id="order-list-title" className="text-h1 text-foreground">
            Order List
          </h2>
          <OrderHeaderActions params={params} />
        </div>
        <OrderListToolbar params={params} counts={counts} />
        <Suspense key={orderParamsHref(params)} fallback={<OrderRowsSkeleton />}>
          <Rows params={params} canUpdate={can(user, "orders:update")} />
        </Suspense>
      </section>
    </Container>
  );
}

async function Rows({ params, canUpdate }: { params: OrderListParams; canUpdate: boolean }) {
  const [page, couriers, settings] = await Promise.all([listAdminOrders(params), getCourierOptions(), getStoreSettings()]);
  // Past the last page (e.g. after bulk changes moved rows to another tab): go to the last real one.
  if (page.rows.length === 0 && page.total > 0 && params.page > page.pages) {
    redirect(orderParamsHref(params, { page: page.pages }));
  }
  return <OrderListView params={params} page={page} ctx={{ canUpdate, couriers, returnWindowDays: settings.returnWindowDays }} />;
}
