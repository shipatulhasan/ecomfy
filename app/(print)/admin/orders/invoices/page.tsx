import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminInvoices } from "@/components/admin/orders/admin-invoices";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Skeleton } from "@/components/ui/skeleton";
import { ORDERS_PER_PAGE, parseOrderParams } from "@/lib/admin/orders/params";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { listOrderNumbers, parseNumberList } from "@/lib/queries/admin/orders";

/**
 * Bulk "Print invoices": several orders in one printable document, one A4 page
 * each (the same InvoiceSheet as the customer's invoice). `?n=1,2,3` (selected
 * rows) or the list's filters (?tab=&q=…&page=: that page's orders). The
 * browser's "Save as PDF" makes one merged PDF. Its own route group: no admin chrome.
 */
export const metadata: Metadata = { title: "Invoices", robots: { index: false, follow: false } };

export default function AdminInvoicesPage({ searchParams }: PageProps<"/admin/orders/invoices">) {
  return (
    <main className="mx-auto w-full max-w-3xl bg-background px-gutter py-8 print:max-w-none print:p-0">
      <Suspense fallback={<Skeleton className="h-200 rounded-lg" />}>
        <Invoices searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Invoices({ searchParams }: Pick<PageProps<"/admin/orders/invoices">, "searchParams">) {
  const user = await requireStaff("/admin/orders");
  if (!can(user, "orders:read")) return <Forbidden />;
  const sp = await searchParams;
  const listed = parseNumberList(typeof sp.n === "string" ? sp.n : null, 100);
  const numbers = listed.length ? listed : await listOrderNumbers(parseOrderParams(sp), ORDERS_PER_PAGE);
  return <AdminInvoices numbers={numbers} autoPrint={sp.print === "1"} back="/admin/orders" />;
}
