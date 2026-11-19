"use client";

import { DownloadIcon, EllipsisVerticalIcon, HouseIcon, PrinterIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { orderParamsQuery, type OrderListParams } from "@/lib/admin/orders/params";
import { invoicesHref, printInvoice } from "../print-invoice";

/**
 * Order Management.png "Order List" header actions. The PNG's green "⊕ Add Order"
 * slot is "Export CSV" (current tab + filters): there's no admin order entry.
 * "More Action ⋮": print this page's invoices, refresh, dashboard.
 */
export function OrderHeaderActions({ params }: { params: OrderListParams }) {
  const router = useRouter();
  const query = orderParamsQuery(params, { page: params.page });
  return (
    <div className="flex shrink-0 items-center gap-3">
      <a
        href={`/admin/orders/export${query ? `?${query}` : ""}`}
        download
        className="press inline-flex h-12 items-center gap-1.5 rounded-lg bg-primary px-4 text-lead font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        <DownloadIcon aria-hidden className="size-5 stroke-[1.5]" />
        Export <span className="hidden tablet:inline">CSV</span>
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger className="press inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-card px-4 text-lead font-medium text-foreground shadow-sm transition-colors hover:bg-muted">
          <span className="hidden tablet:inline">More Action</span>
          <span className="sr-only tablet:hidden">More actions</span>
          <EllipsisVerticalIcon aria-hidden className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuItem onSelect={() => printInvoice(invoicesHref(query))}>
            <PrinterIcon aria-hidden /> Print invoices (this page)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => router.refresh()}>
            <RefreshCwIcon aria-hidden /> Refresh list
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <HouseIcon aria-hidden /> Dashboard
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
