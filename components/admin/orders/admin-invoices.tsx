import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceSheet } from "@/components/shared/invoice/invoice-sheet";
import { PrintButton } from "@/components/shop/invoice/print-button";
import { getOrdersForInvoice } from "@/lib/queries/admin/orders";

/** One or several invoices, each on its own printed page. Callers check orders:read first. */
export async function AdminInvoices({
  numbers,
  autoPrint,
  back,
  notFoundIfEmpty,
}: {
  numbers: number[];
  autoPrint: boolean;
  back: string;
  notFoundIfEmpty?: boolean;
}) {
  const orders = await getOrdersForInvoice(numbers);
  if (!orders.length && notFoundIfEmpty) notFound();
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={back} className="tap-target text-copy font-medium text-primary hover:underline">
          ← Back
        </Link>
        {orders.length > 1 && <span className="text-copy text-text-body">{orders.length} invoices</span>}
        {orders.length > 0 && <PrintButton auto={autoPrint} />}
      </div>
      {orders.length === 0 ? (
        <p className="text-copy text-text-body">No orders to print.</p>
      ) : (
        <div className="flex flex-col gap-8 print:gap-0">
          {orders.map((o, i) => (
            <InvoiceSheet key={o.number} order={o} className={i < orders.length - 1 ? "break-after-page" : undefined} />
          ))}
        </div>
      )}
    </>
  );
}
