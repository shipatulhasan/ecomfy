import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminInvoices } from "@/components/admin/orders/admin-invoices";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Skeleton } from "@/components/ui/skeleton";
import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { orderNumberSchema } from "@/lib/validations/orders";

/**
 * Admin → order → Print invoice: the customer's invoice template (InvoiceSheet)
 * for any order, behind orders:read. Its own route group: no admin chrome.
 */
export const metadata: Metadata = { title: "Invoice", robots: { index: false, follow: false } };

export default function AdminInvoicePage({ params, searchParams }: PageProps<"/admin/orders/[orderNumber]/invoice">) {
  return (
    <main className="mx-auto w-full max-w-3xl bg-background px-gutter py-8 print:max-w-none print:p-0">
      <Suspense fallback={<Skeleton className="h-200 rounded-lg" />}>
        <Invoice params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Invoice({ params, searchParams }: Pick<PageProps<"/admin/orders/[orderNumber]/invoice">, "params" | "searchParams">) {
  const { orderNumber } = await params;
  const user = await requireStaff(`/admin/orders/${encodeURIComponent(orderNumber)}`);
  if (!can(user, "orders:read")) return <Forbidden />;
  const parsed = orderNumberSchema.safeParse(decodeURIComponent(orderNumber));
  if (!parsed.success) notFound();
  const sp = await searchParams;
  return <AdminInvoices numbers={[parsed.data]} autoPrint={sp.print === "1"} back={`/admin/orders/${parsed.data}`} notFoundIfEmpty />;
}
