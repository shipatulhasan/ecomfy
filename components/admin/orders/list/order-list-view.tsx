"use client";

import { BanIcon, CheckCircle2Icon, ChevronRightIcon, DownloadIcon, PackageCheckIcon, PrinterIcon, ReceiptTextIcon, TruckIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ListPagination } from "@/components/admin/products/list/pagination";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { bulkChangeStatus, type BulkReport } from "@/lib/actions/admin-orders";
import { formatDhaka } from "@/lib/admin/date-range";
import {
  adminOrderHref,
  CLEARED_FILTERS,
  hasOrderFilters,
  ORDERS_PER_PAGE,
  orderParamsHref,
  orderRef,
  type OrderListParams,
} from "@/lib/admin/orders/params";
import { formatPrice } from "@/lib/money";
import type { AdminOrderPage, AdminOrderRow } from "@/lib/queries/admin/orders";
import { cn } from "@/lib/utils";
import { FlagBadge, ItemThumb, OrderStatusText, PaymentCell } from "../order-cells";
import { invoicesHref, printInvoice } from "../print-invoice";
import { CancelDialog, formatReport, reportToast, ShipDialog } from "../status-dialogs";
import { useOrderAction } from "../use-order-action";
import { OrderRowActions, OrderRowActionsSheet } from "./row-actions";

type Ctx = { canUpdate: boolean; couriers: string[]; returnWindowDays: number };

/**
 * Order Management.png table (laptop+) and cards (below laptop). Rows are server
 * data; a row click opens the order. Selection drives the bulk bar (not in the
 * PNG): Confirm COD · Mark shipped · Mark delivered · Cancel · Print invoices ·
 * Export CSV. Each bulk run reports per order.
 */
export function OrderListView({ params, page, ctx }: { params: OrderListParams; page: AdminOrderPage; ctx: Ctx }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [report, setReport] = useState<BulkReport | null>(null);
  const numbers = useMemo(() => page.rows.map((r) => r.number), [page.rows]);
  // Drop selections that left the page (after a refresh / filter change).
  const live = useMemo(() => new Set([...selected].filter((n) => numbers.includes(n))), [selected, numbers]);
  const all = numbers.length > 0 && live.size === numbers.length;
  const selectable = true; // printing / export work read-only too

  const toggle = (n: number, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(n);
      else next.delete(n);
      return next;
    });
  const toggleAll = (on: boolean) => setSelected(on ? new Set(numbers) : new Set());

  const open = (n: number) => router.push(adminOrderHref(n));
  /** Row click: anywhere except the controls inside it. */
  const onRowClick = (e: React.MouseEvent, n: number) => {
    if ((e.target as HTMLElement).closest("a,button,input,label,[role=checkbox],[role=menuitem]")) return;
    if (window.getSelection()?.toString()) return; // selecting text, not opening
    open(n);
  };

  if (page.rows.length === 0) return <EmptyState params={params} />;
  const offset = (page.page - 1) * ORDERS_PER_PAGE;

  return (
    <div className="mt-6">
      <p aria-live="polite" className="sr-only">
        {page.total} orders, page {page.page} of {page.pages}
      </p>

      {report && <ReportBanner report={report} onClose={() => setReport(null)} />}

      {/* Laptop+: the PNG table (scrolls inside the card when the column gets narrow). */}
      <div className="hidden overflow-x-auto laptop:block">
        <table className="w-full min-w-245 table-fixed text-left text-copy text-foreground">
          <colgroup>
            <col className="w-20" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[19%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-12" />
          </colgroup>
          <thead className="bg-secondary">
            <tr className="h-14">
              <th scope="col" className="rounded-l-lg pl-3 font-medium">
                <span className="flex items-center gap-3">
                  {selectable && (
                    <Checkbox
                      aria-label="Select all orders on this page"
                      checked={all ? true : live.size > 0 ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      className="size-5 rounded border-foreground/40 bg-card"
                    />
                  )}
                  No.
                </span>
              </th>
              <th scope="col" className="px-3 font-medium">
                Order Id
              </th>
              <th scope="col" className="px-3 font-medium">
                Customer
              </th>
              <th scope="col" className="px-3 font-medium">
                Items
              </th>
              <th scope="col" className="px-3 text-center font-medium">
                Date
              </th>
              <th scope="col" className="px-3 text-center font-medium">
                Total
              </th>
              <th scope="col" className="px-3 font-medium">
                Payment
              </th>
              <th scope="col" className="px-3 font-medium">
                Status
              </th>
              <th scope="col" className="rounded-r-lg px-2 font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border border-b border-border">
            {page.rows.map((r, i) => (
              <tr
                key={r.id}
                onClick={(e) => onRowClick(e, r.number)}
                className={cn("h-17 cursor-pointer transition-colors hover:bg-muted", live.has(r.number) && "bg-secondary/40 hover:bg-secondary/60")}
              >
                <td className="pl-3">
                  <span className="flex items-center gap-3">
                    {selectable && (
                      <Checkbox
                        aria-label={`Select order ${orderRef(r.number)}`}
                        checked={live.has(r.number)}
                        onCheckedChange={(v) => toggle(r.number, v === true)}
                        className="size-5 rounded border-foreground/40"
                      />
                    )}
                    <span className="tabular-nums">{offset + i + 1}</span>
                  </span>
                </td>
                <td className="px-3">
                  <Link href={adminOrderHref(r.number)} className="font-medium hover:text-primary hover:underline">
                    {orderRef(r.number)}
                  </Link>
                  {r.codFlagged && <FlagBadge reason={r.codFlagReason} className="mt-1 flex w-fit" />}
                </td>
                <td className="px-3">
                  <span className="block truncate" title={r.customer.name}>
                    {r.customer.name}
                  </span>
                  <span className="block truncate text-caption text-muted-foreground">{r.customer.phone}</span>
                </td>
                <td className="px-3">
                  <ItemsCell row={r} />
                </td>
                <td className="px-3 text-center leading-5 tabular-nums">
                  {formatDhaka(r.createdAt, "dd-MM-yyyy")}
                  <span className="block text-caption text-muted-foreground">{formatDhaka(r.createdAt, "h:mm a")}</span>
                </td>
                <td className="px-3 text-center tabular-nums">{formatPrice(r.totalCents)}</td>
                <td className="px-3">
                  <PaymentCell method={r.paymentMethod} status={r.paymentStatus} />
                </td>
                <td className="px-3">
                  <OrderStatusText status={r.status} />
                </td>
                <td className="px-2">
                  <OrderRowActions row={r} ctx={ctx} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Below laptop: cards. */}
      <div className="laptop:hidden">
        <label className="flex min-h-11 items-center gap-3 px-1 text-copy text-text-body">
          <Checkbox checked={all ? true : live.size > 0 ? "indeterminate" : false} onCheckedChange={(v) => toggleAll(v === true)} className="size-5" />
          Select all on this page
        </label>
        <ul className="grid gap-3 tablet:grid-cols-2">
          {page.rows.map((r) => (
            <li key={r.id} className={cn("relative flex gap-3 rounded-xl border border-border p-3", live.has(r.number) && "border-primary bg-secondary/40")}>
              <Checkbox
                aria-label={`Select order ${orderRef(r.number)}`}
                checked={live.has(r.number)}
                onCheckedChange={(v) => toggle(r.number, v === true)}
                className="relative z-10 mt-0.5 size-5"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <Link href={adminOrderHref(r.number)} data-slot="card-link" className="text-lead font-medium text-foreground after:absolute after:inset-0">
                      {orderRef(r.number)}
                    </Link>
                    {r.codFlagged && <FlagBadge reason={r.codFlagReason} className="relative z-10" />}
                  </div>
                  <span className="relative z-10 -mt-1 -mr-1">
                    <OrderRowActionsSheet row={r} ctx={ctx} />
                  </span>
                </div>
                <p className="truncate text-copy text-foreground">
                  {r.customer.name} <span className="text-muted-foreground">· {r.customer.phone}</span>
                </p>
                <ItemsCell row={r} />
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-copy">
                  <OrderStatusText status={r.status} />
                  <span className="font-medium tabular-nums">{formatPrice(r.totalCents)}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-copy">
                  <PaymentCell method={r.paymentMethod} status={r.paymentStatus} inline />
                  <span className="text-caption text-muted-foreground">{formatDhaka(r.createdAt, "dd MMM yyyy, h:mm a")}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {live.size > 0 && (
        <BulkBar
          rows={page.rows.filter((r) => live.has(r.number))}
          ctx={ctx}
          onClear={() => setSelected(new Set())}
          onReport={(r) => {
            setReport(r);
            setSelected(new Set());
          }}
        />
      )}

      <ListPagination page={params.page} pages={page.pages} href={(n) => orderParamsHref(params, { page: n })} />
    </div>
  );
}

function ItemsCell({ row }: { row: AdminOrderRow }) {
  const more = row.itemCount - 1;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <ItemThumb src={row.firstItem?.imageUrl ?? null} />
      <span className="min-w-0 leading-5">
        <span className="line-clamp-2" title={row.firstItem?.name}>
          {row.firstItem?.name ?? "No items"}
        </span>
        {more > 0 && <span className="block text-caption text-muted-foreground">+{more} more</span>}
      </span>
    </span>
  );
}

// ───────────────────────────── bulk ─────────────────────────────

function BulkBar({ rows, ctx, onClear, onReport }: { rows: AdminOrderRow[]; ctx: Ctx; onClear: () => void; onReport: (r: BulkReport) => void }) {
  const { run, pending } = useOrderAction();
  const [dialog, setDialog] = useState<"ship" | "cancel" | null>(null);
  const [sheet, setSheet] = useState(false);
  const n = rows.length;
  const items = rows.map((r) => ({ orderNumber: r.number, version: r.version }));
  const dialogOrders = rows.map((r) => ({
    number: r.number,
    version: r.version,
    courier: r.courier,
    trackingNumber: r.trackingNumber,
    paid: r.paymentStatus === "PAID",
  }));
  const numbersCsv = rows.map((r) => r.number).join(",");
  const printHref = invoicesHref(`n=${numbersCsv}`);
  const exportHref = `/admin/orders/export?n=${numbersCsv}`;

  const direct = async (to: "PROCESSING" | "DELIVERED") => {
    const res = await run(() => bulkChangeStatus({ to, items }), null);
    if (res.ok) {
      reportToast(res.data);
      onReport(res.data);
    }
  };

  const actions: { key: string; label: string; icon: typeof TruckIcon; onClick?: () => void; href?: string; danger?: boolean; write?: boolean }[] = [
    { key: "confirm", label: "Confirm COD", icon: CheckCircle2Icon, onClick: () => direct("PROCESSING"), write: true },
    { key: "ship", label: "Mark shipped", icon: TruckIcon, onClick: () => setDialog("ship"), write: true },
    { key: "deliver", label: "Mark delivered", icon: PackageCheckIcon, onClick: () => direct("DELIVERED"), write: true },
    { key: "cancel", label: "Cancel", icon: BanIcon, onClick: () => setDialog("cancel"), danger: true, write: true },
    { key: "print", label: "Print invoices", icon: PrinterIcon, onClick: () => printInvoice(printHref) },
    { key: "export", label: "Export CSV", icon: DownloadIcon, href: exportHref },
  ];
  const visible = actions.filter((a) => !a.write || ctx.canUpdate);

  const done = (r: BulkReport | null) => {
    if (r) onReport(r);
  };

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-(--app-bottom-safe) z-10 mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-lg"
    >
      <span className="mr-auto flex items-center gap-2 text-copy font-bold text-foreground">
        <button type="button" aria-label="Clear selection" onClick={onClear} className="tap-target grid size-8 place-items-center rounded-md hover:bg-muted">
          <XIcon aria-hidden className="size-4" />
        </button>
        {n} selected
      </span>

      {/* Laptop+: buttons inline. */}
      <div className="hidden flex-wrap items-center justify-end gap-2 laptop:flex">
        {visible.map((a) =>
          a.href ? (
            <Button key={a.key} asChild size="lg" variant="outline" className="h-10 px-4">
              <a href={a.href} download>
                <a.icon aria-hidden /> {a.label}
              </a>
            </Button>
          ) : (
            <Button
              key={a.key}
              size="lg"
              variant={a.danger ? "destructive" : a.key === "confirm" ? "default" : "outline"}
              className="h-10 px-4"
              disabled={pending}
              onClick={a.onClick}
            >
              <a.icon aria-hidden /> {a.label}
            </Button>
          ),
        )}
      </div>

      {/* Below laptop: one button → the actions in a bottom sheet. */}
      <BottomSheet
        open={sheet}
        onOpenChange={setSheet}
        title={`${n} order${n === 1 ? "" : "s"} selected`}
        closeOnLink
        trigger={
          <Button size="lg" className="h-11 px-5 laptop:hidden" disabled={pending}>
            Actions
          </Button>
        }
      >
        <ul className="flex flex-col py-1">
          {visible.map((a) => {
            const cls = cn(
              "tap-target flex w-full items-center gap-3 rounded-lg px-3 py-3 text-lead hover:bg-muted disabled:opacity-50",
              a.danger ? "text-sale" : "text-foreground",
            );
            return (
              <li key={a.key}>
                {a.href ? (
                  <a href={a.href} download className={cls}>
                    <a.icon aria-hidden className="size-5" /> {a.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={cls}
                    disabled={pending}
                    onClick={() => {
                      setSheet(false);
                      a.onClick?.();
                    }}
                  >
                    <a.icon aria-hidden className="size-5" /> {a.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </BottomSheet>

      {ctx.canUpdate && (
        <>
          <ShipDialog open={dialog === "ship"} onOpenChange={(o) => setDialog(o ? "ship" : null)} orders={dialogOrders} couriers={ctx.couriers} onDone={done} />
          <CancelDialog open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)} orders={dialogOrders} onDone={done} />
        </>
      )}
    </div>
  );
}

/** Per-order outcome of the last bulk run, until dismissed. */
function ReportBanner({ report, onClose }: { report: BulkReport; onClose: () => void }) {
  const tone = report.skipped.length ? (report.updated.length ? "warning" : "danger") : "success";
  return (
    <div
      role="status"
      className={cn(
        "mb-4 flex items-start gap-3 rounded-lg px-4 py-3 text-copy",
        tone === "success" && "bg-success-soft/40 text-brand-dark",
        tone === "warning" && "bg-warning-soft text-warning-strong",
        tone === "danger" && "bg-sale-soft text-sale",
      )}
    >
      <ReceiptTextIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{formatReport({ updated: report.updated, skipped: [] })}{report.skipped.length ? `, ${report.skipped.length} skipped` : ""}</p>
        {report.skipped.length > 0 && (
          <ul className="mt-1 flex flex-col gap-0.5">
            {report.skipped.map((s) => (
              <li key={s.number}>
                <Link href={adminOrderHref(s.number)} className="font-medium underline-offset-2 hover:underline">
                  {orderRef(s.number)}
                </Link>{" "}
                {s.reason}
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="button" aria-label="Dismiss" onClick={onClose} className="tap-target grid size-8 shrink-0 place-items-center rounded-md hover:bg-card/60">
        <XIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}

function EmptyState({ params }: { params: OrderListParams }) {
  const filtered = hasOrderFilters(params) || params.tab !== "all";
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <ReceiptTextIcon aria-hidden className="size-10 text-muted-foreground" />
      <h2 className="text-h3 text-foreground">{filtered ? "No orders match" : "No orders yet"}</h2>
      <p className="max-w-sm text-copy text-muted-foreground">
        {filtered ? "Try another search, tab or filter." : "New orders from the store show up here."}
      </p>
      {filtered && (
        <Button asChild variant="outline" className="h-10 px-4">
          <Link href={orderParamsHref(params, { ...CLEARED_FILTERS, tab: "all" })}>
            Clear filters <ChevronRightIcon aria-hidden />
          </Link>
        </Button>
      )}
    </div>
  );
}
