import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddNewProduct, AddNewProductSkeleton } from "@/components/admin/dashboard/add-new-product";
import { BestSelling, BestSellingSkeleton } from "@/components/admin/dashboard/best-selling";
import { KpiSkeleton, OrdersCard, PendingCanceledCard, SalesCard } from "@/components/admin/dashboard/kpi-cards";
import { TopProducts, TopProductsSkeleton } from "@/components/admin/dashboard/top-products";
import { Transactions, TransactionsSkeleton } from "@/components/admin/dashboard/transactions";
import { WeeklyReport, WeeklyReportSkeleton } from "@/components/admin/dashboard/weekly-report";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { parseRange } from "@/lib/admin/date-range";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import type { TxFilter } from "@/lib/queries/admin/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Dashboard.png. URL state: ?range=7d|30d|90d|custom(&from&to) for the KPIs, Top
 * Products and Best selling; ?week=last for the weekly report; ?tx=paid|pending;
 * ?bestCat=<category slug>. Every widget streams in its own Suspense boundary.
 *
 * Grid (design-px at 1440): 3 KPIs; Report 749 | Top Products 366; Transaction;
 * Add New Product 366 | Best selling 749. 24 apart, 20 under the top bar.
 * Laptop: KPIs 2 + 1, Report full, Top Products | Add New, then the tables.
 * Tablet / mobile: KPIs 2 / 1 columns, everything else full width.
 */
export default function AdminDashboardPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Dashboard({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  const user = await requireStaff("/admin");
  if (!can(user, "dashboard:read")) return <Forbidden />;

  const sp = await searchParams;
  await connection(); // ranges are relative to "now" (Asia/Dhaka)
  const range = parseRange(sp);
  const week = one(sp.week) === "last" ? "last" : "this";
  const txRaw = one(sp.tx);
  const tx: TxFilter = txRaw === "paid" || txRaw === "pending" ? txRaw : "all";
  const bestRaw = one(sp.bestCat);
  const bestCat = bestRaw && /^[a-z0-9-]{1,80}$/.test(bestRaw) ? bestRaw : null;
  const query = Object.fromEntries(
    Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])),
  ) as Record<string, string>;

  return (
    <Grid>
      <div className="grid gap-4 tablet:grid-cols-2 tablet:gap-6 laptop:col-span-2 laptop:row-start-1 desktop:col-span-3 desktop:grid-cols-3">
        <Suspense fallback={<KpiSkeleton />}>
          <SalesCard range={range} />
        </Suspense>
        <Suspense fallback={<KpiSkeleton />}>
          <OrdersCard range={range} />
        </Suspense>
        <div className="tablet:col-span-2 desktop:col-span-1 [&>*]:h-full">
          <Suspense fallback={<KpiSkeleton />}>
            <PendingCanceledCard range={range} />
          </Suspense>
        </div>
      </div>
      <div className="laptop:col-span-2 laptop:row-start-2 desktop:col-span-2 [&>*]:h-full">
        <Suspense fallback={<WeeklyReportSkeleton />}>
          <WeeklyReport week={week} query={query} />
        </Suspense>
      </div>
      <div className="laptop:col-start-1 laptop:row-start-3 desktop:col-start-3 desktop:row-start-2 [&>*]:h-full">
        <Suspense fallback={<TopProductsSkeleton />}>
          <TopProducts range={range} />
        </Suspense>
      </div>
      <div className="laptop:col-span-2 laptop:row-start-4 desktop:col-span-3 desktop:row-start-3">
        <Suspense fallback={<TransactionsSkeleton />}>
          <Transactions filter={tx} />
        </Suspense>
      </div>
      <div className="laptop:col-start-2 laptop:row-start-3 desktop:col-start-1 desktop:row-start-4 [&>*]:h-full">
        <Suspense fallback={<AddNewProductSkeleton />}>
          <AddNewProduct />
        </Suspense>
      </div>
      <div className="laptop:col-span-2 laptop:row-start-5 desktop:col-span-2 desktop:col-start-2 desktop:row-start-4 [&>*]:h-full">
        <Suspense fallback={<BestSellingSkeleton />}>
          <BestSelling range={range} category={bestCat} />
        </Suspense>
      </div>
    </Grid>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <Container
      variant="admin"
      className="grid grid-cols-1 gap-4 pt-4 pb-8 tablet:gap-6 laptop:grid-cols-2 laptop:pt-5 desktop:grid-cols-[366fr_359fr_366fr]"
    >
      {children}
    </Container>
  );
}

function DashboardSkeleton() {
  return (
    <Grid>
      <div className="grid gap-4 tablet:grid-cols-2 tablet:gap-6 laptop:col-span-2 desktop:col-span-3 desktop:grid-cols-3">
        <KpiSkeleton />
        <KpiSkeleton />
        <div className="tablet:col-span-2 desktop:col-span-1">
          <KpiSkeleton />
        </div>
      </div>
      <div className="laptop:col-span-2">
        <WeeklyReportSkeleton />
      </div>
      <TopProductsSkeleton />
    </Grid>
  );
}
