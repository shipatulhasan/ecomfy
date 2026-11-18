import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { InvoiceSheet } from "@/components/shared/invoice/invoice-sheet";
import { PrintButton } from "@/components/shop/invoice/print-button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth-guards";
import { getUserOrder } from "@/lib/queries/orders";
import { orderNumberSchema } from "@/lib/validations/orders";

/**
 * Printable invoice for one of the signed-in customer's orders ("Download invoice"
 * on Order Details): the shared InvoiceSheet (also used by the admin print routes)
 * on an A4 print sheet (app/globals.css → Printing); "Save as PDF" in the browser.
 *
 * Its own route group: no storefront chrome. Same ownership rule as the details
 * page (another customer's order → 404). Amounts are the charged BDT amounts.
 */
export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

export default function InvoicePage({ params, searchParams }: PageProps<"/account/orders/[orderNumber]/invoice">) {
  return (
    <main className="mx-auto w-full max-w-3xl bg-background px-gutter py-8 print:max-w-none print:p-0">
      <Suspense fallback={<Skeleton className="h-200 rounded-lg" />}>
        <Invoice params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Invoice({ params, searchParams }: Pick<PageProps<"/account/orders/[orderNumber]/invoice">, "params" | "searchParams">) {
  const user = await requireUser();
  const parsed = orderNumberSchema.safeParse((await params).orderNumber);
  if (!parsed.success) notFound();
  const order = await getUserOrder(user.id, parsed.data);
  if (!order) notFound();
  const autoPrint = (await searchParams).print === "1";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/account/orders/${order.number}`} className="tap-target text-copy font-medium text-primary hover:underline">
          ← Back to order
        </Link>
        <PrintButton auto={autoPrint} />
      </div>

      <InvoiceSheet order={order} />
    </>
  );
}
