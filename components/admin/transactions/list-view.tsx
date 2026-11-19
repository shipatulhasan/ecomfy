"use client";

import { ChevronRightIcon, ReceiptTextIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CopyButton } from "@/components/admin/orders/detail/forms";
import { ListPagination } from "@/components/admin/products/list/pagination";
import { Button } from "@/components/ui/button";
import { formatDhaka } from "@/lib/admin/date-range";
import { adminOrderHref, orderRef } from "@/lib/admin/orders/params";
import { CLEARED_TXN_FILTERS, hasTxnFilters, txnParamsHref, txnSheetHref, type TxnListParams } from "@/lib/admin/transactions/params";
import { ATTENTION_LABELS } from "@/lib/payments/attention-labels";
import type { AdminTxnPage, AdminTxnRow } from "@/lib/queries/admin/transactions";
import { cn } from "@/lib/utils";
import { MethodLogo, TxnAmount, TxnStatusText, TxnTypeTag } from "./cells";

/**
 * Transaction.png table (laptop+) and cards (below laptop). Seven columns, as in
 * the PNG, adapted to a payment ledger: Transaction (gateway id + order) ·
 * Customer · Date · Amount · Method · Status · Action ("View Details" → the
 * detail sheet, ?txn=). A row click opens the sheet too.
 */
export function TxnListView({ params, page }: { params: TxnListParams; page: AdminTxnPage }) {
  const router = useRouter();
  const open = (id: string) => router.push(txnSheetHref(params, id), { scroll: false });
  const onRowClick = (e: React.MouseEvent, id: string) => {
    if ((e.target as HTMLElement).closest("a,button,input,label,[role=menuitem]")) return;
    if (window.getSelection()?.toString()) return; // selecting text, not opening
    open(id);
  };

  if (page.rows.length === 0) return <EmptyState params={params} />;

  return (
    <div className="mt-6">
      <p aria-live="polite" className="sr-only">
        {page.total} transactions, page {page.page} of {page.pages}
      </p>

      {/* Laptop+: the PNG table (scrolls inside the card when the column gets narrow). */}
      <div className="hidden overflow-x-auto laptop:block">
        <table className="w-full min-w-215 table-fixed text-center text-copy text-foreground">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[17%]" />
            <col className="w-[13%]" />
            <col className="w-[13%]" />
            <col className="w-[12%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
          </colgroup>
          <thead className="bg-secondary">
            <tr className="h-14 text-lead">
              <th scope="col" className="rounded-l-lg px-3 font-medium">
                Transaction
              </th>
              <th scope="col" className="px-3 font-medium">
                Customer
              </th>
              <th scope="col" className="px-3 font-medium">
                Date
              </th>
              <th scope="col" className="px-3 font-medium">
                Total
              </th>
              <th scope="col" className="px-3 font-medium">
                Method
              </th>
              <th scope="col" className="px-3 font-medium">
                Status
              </th>
              <th scope="col" className="rounded-r-lg px-3 font-medium">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border border-b border-border">
            {page.rows.map((r) => (
              <tr key={r.id} onClick={(e) => onRowClick(e, r.id)} className={cn("h-15.5 cursor-pointer transition-colors hover:bg-muted", params.txn === r.id && "bg-secondary/40")}>
                <td className="px-3 py-2">
                  <span className="flex items-center justify-center gap-1">
                    <span className="min-w-0 truncate font-mono text-copy" title={r.gatewayId}>
                      {r.gatewayId}
                    </span>
                    <CopyButton value={r.gatewayId} label={`Copy transaction id ${r.gatewayId}`} className="size-7" />
                  </span>
                  <span className="flex items-center justify-center gap-1.5 text-caption text-muted-foreground">
                    <Link href={adminOrderHref(r.order.number)} className="hover:text-primary hover:underline">
                      Order {orderRef(r.order.number)}
                    </Link>
                    {r.attention.length > 0 && <AttentionMark row={r} />}
                  </span>
                </td>
                <td className="px-3">
                  <span className="block truncate" title={r.customer.name}>
                    {r.customer.name}
                  </span>
                  <span className="block truncate text-caption text-muted-foreground">{r.customer.phone ?? r.customer.email}</span>
                </td>
                <td className="px-3 leading-5 tabular-nums">
                  {formatDhaka(r.createdAt, "dd-MM-yyyy")}
                  <span className="block text-caption text-muted-foreground">{formatDhaka(r.createdAt, "h:mm a")}</span>
                </td>
                <td className="px-3">
                  <TxnAmount cents={r.amountCents} className="block" />
                  <TxnTypeTag type={r.type} className="mt-0.5" />
                </td>
                <td className="px-3">
                  <MethodLogo method={r.method} className="justify-center" />
                </td>
                <td className="px-3">
                  <TxnStatusText status={r.status} />
                </td>
                <td className="px-3">
                  <Link href={txnSheetHref(params, r.id)} scroll={false} className="tap-target inline-flex items-center text-info hover:underline">
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Below laptop: cards; tapping one opens the detail sheet. */}
      <ul className="grid gap-3 tablet:grid-cols-2 laptop:hidden">
        {page.rows.map((r) => (
          <li key={r.id} className="press-card relative flex flex-col gap-2 rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={txnSheetHref(params, r.id)}
                  scroll={false}
                  data-slot="card-link"
                  className="block truncate font-mono text-copy font-medium text-foreground after:absolute after:inset-0"
                >
                  <span className="sr-only">View details of transaction </span>
                  {r.gatewayId}
                </Link>
                <span className="text-caption text-muted-foreground">
                  Order {orderRef(r.order.number)} · {formatDhaka(r.createdAt, "dd MMM yyyy, h:mm a")}
                </span>
              </div>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <TxnAmount cents={r.amountCents} className="text-lead font-medium" />
                <TxnTypeTag type={r.type} />
              </span>
            </div>
            <p className="truncate text-copy text-foreground">
              {r.customer.name}
              {(r.customer.phone ?? r.customer.email) && <span className="text-muted-foreground"> · {r.customer.phone ?? r.customer.email}</span>}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-copy">
              <MethodLogo method={r.method} withLabel />
              <TxnStatusText status={r.status} />
            </div>
            {r.attention.length > 0 && (
              <p className="flex items-center gap-1.5 text-caption text-warning-strong">
                <TriangleAlertIcon aria-hidden className="size-4 shrink-0" />
                {r.attention.map((a) => ATTENTION_LABELS[a]).join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ul>

      <ListPagination page={params.page} pages={page.pages} href={(n) => txnParamsHref(params, { page: n })} />
    </div>
  );
}

function AttentionMark({ row }: { row: AdminTxnRow }) {
  const text = row.attention.map((a) => ATTENTION_LABELS[a]).join(" · ");
  return (
    <span title={text} className="inline-flex items-center text-warning-strong">
      <TriangleAlertIcon aria-hidden className="size-3.5" />
      <span className="sr-only">Needs attention: {text}</span>
    </span>
  );
}

function EmptyState({ params }: { params: TxnListParams }) {
  const filtered = hasTxnFilters(params) || params.tab !== "all";
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <ReceiptTextIcon aria-hidden className="size-10 text-muted-foreground" />
      <h2 className="text-h3 text-foreground">{params.attention ? "Nothing needs attention" : filtered ? "No transactions match" : "No transactions yet"}</h2>
      <p className="max-w-sm text-copy text-muted-foreground">
        {params.attention
          ? "No stuck, mismatched or duplicate payments right now."
          : filtered
            ? "Try another search, tab or filter."
            : "Payments, COD collections and refunds show up here."}
      </p>
      {filtered && (
        <Button asChild variant="outline" className="h-10 px-4">
          <Link href={txnParamsHref(params, { ...CLEARED_TXN_FILTERS, tab: "all" })} replace scroll={false}>
            Clear filters <ChevronRightIcon aria-hidden />
          </Link>
        </Button>
      )}
    </div>
  );
}
