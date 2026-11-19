import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { TxnDetailSheet } from "@/components/admin/transactions/detail-sheet";
import { TxnKpiCard, TxnKpiSkeleton, type TxnKpiKind } from "@/components/admin/transactions/kpi-cards";
import { TxnListView } from "@/components/admin/transactions/list-view";
import { MethodCard, MethodCardSkeleton } from "@/components/admin/transactions/method-card";
import { TxnSheetFrame } from "@/components/admin/transactions/sheet-frame";
import { TxnDetailSkeleton, TxnPageSkeleton, TxnRowsSkeleton } from "@/components/admin/transactions/skeletons";
import { TxnToolbar } from "@/components/admin/transactions/toolbar";
import { Container } from "@/components/shared/container";
import { Rail, RailItem } from "@/components/shared/rail";
import { parseTxnParams, txnListKey, txnParamsHref, type TxnListParams } from "@/lib/admin/transactions/params";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { getTxnTabCounts, listTransactions } from "@/lib/queries/admin/transactions";

export const metadata: Metadata = { title: "Transaction", robots: { index: false, follow: false } };

const KPIS: TxnKpiKind[] = ["revenue", "completed", "pending", "failed"];

/**
 * Transactions (designs/screens/admin/Transaction.png): four counters and the
 * Payment Method box, then the payment history card (tabs, search, filters,
 * table, pager). Every money movement is a Payment row (charges, COD collections,
 * refunds). All list state lives in the URL (?tab=&q=&method=&status=&type=&from=
 * &to=&min=&max=&attention=&sort=&page=), the detail sheet too (?txn=). Read-only
 * except "Verify with gateway" (payments:reconcile) and CSV export (payments:export).
 * Rows carry customer PII (masked for STAFF): request-time only, never cached.
 * Deliberate changes from the PNG are listed in designs/DESIGN.md.
 */
export default function TransactionsPage({ searchParams }: PageProps<"/admin/transactions">) {
  return (
    <Suspense fallback={<TxnPageSkeleton />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/admin/transactions">, "searchParams">) {
  const user = await requireStaff("/admin/transactions");
  if (!can(user, "payments:read")) return <Forbidden />;
  const params = parseTxnParams(await searchParams);
  const counts = await getTxnTabCounts(params);

  return (
    <Container variant="admin" className="flex flex-col gap-6 py-5">
      {/* Laptop+: 2 × 2 counters + the Payment Method box (PNG 323 / 323 / 461). Below: counters in a rail. */}
      <div className="flex min-w-0 flex-col gap-4 laptop:grid laptop:grid-cols-[323fr_323fr_461fr]">
        <Rail size="stat" laptop="grid" aria-label="Transaction counters" className="shrink-0 laptop:col-span-2 laptop:grid-cols-2 laptop:gap-4">
          {KPIS.map((kind) => (
            <RailItem key={kind} className="tablet:w-[calc((100%-2rem)/2.4)] laptop:w-auto">
              <Suspense fallback={<TxnKpiSkeleton />}>
                <TxnKpiCard kind={kind} />
              </Suspense>
            </RailItem>
          ))}
        </Rail>
        <Suspense fallback={<MethodCardSkeleton />}>
          <MethodCard />
        </Suspense>
      </div>

      <section aria-labelledby="txn-list-title" className="rounded-xl bg-card p-4 tablet:p-6">
        <h2 id="txn-list-title" className="sr-only">
          Payment history
        </h2>
        <TxnToolbar params={params} counts={counts} canExport={can(user, "payments:export")} />
        <Suspense key={txnListKey(params)} fallback={<TxnRowsSkeleton />}>
          <Rows params={params} />
        </Suspense>
      </section>

      {params.txn && (
        <Suspense
          key={params.txn}
          fallback={
            <TxnSheetFrame closeHref={txnParamsHref(params, { page: params.page })} title="Transaction details">
              <TxnDetailSkeleton />
            </TxnSheetFrame>
          }
        >
          <TxnDetailSheet
            id={params.txn}
            params={params}
            closeHref={txnParamsHref(params, { page: params.page })}
            canReconcile={can(user, "payments:reconcile")}
          />
        </Suspense>
      )}
    </Container>
  );
}

async function Rows({ params }: { params: TxnListParams }) {
  const page = await listTransactions(params);
  // Past the last page (e.g. a filter shrank the list): go to the last real one.
  if (page.rows.length === 0 && page.total > 0 && params.page > page.pages) {
    redirect(txnParamsHref(params, { page: page.pages, txn: params.txn }));
  }
  return <TxnListView params={params} page={page} />;
}
