import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { DateRange } from "@/lib/admin/date-range";
import { formatPrice } from "@/lib/money";
import { getAddNewProduct, getBestSelling } from "@/lib/queries/admin/dashboard";
import { cn } from "@/lib/utils";
import { DashCard, DashCardHeader, SeeMore } from "./dash-card";
import { FilterMenu } from "./filter-menu";
import { ProductThumb } from "./product-thumb";

function StockStatus({ available }: { available: number }) {
  const inStock = available > 0;
  return (
    <span className={cn("inline-flex items-center gap-2 text-lead", inStock ? "text-success" : "text-sale")}>
      <span aria-hidden className={cn("size-1.5 rounded-full", inStock ? "bg-success" : "bg-sale")} />
      {inStock ? "Stock" : "Stock out"}
    </span>
  );
}

/**
 * "Best selling product" (749×617): products by orders in the range, with stock
 * state; Filter = category (?bestCat=slug). Table from tablet, cards on mobile.
 */
export async function BestSelling({ range, category }: { range: DateRange; category: string | null }) {
  const [rows, { categoryOptions }] = await Promise.all([getBestSelling(range, category), getAddNewProduct()]);
  const options = [{ value: "all", label: "All categories" }, ...categoryOptions.map((c) => ({ value: c.slug, label: c.name }))];
  return (
    <DashCard aria-labelledby="best-title" className="flex flex-col">
      <DashCardHeader
        titleId="best-title"
        title="Best selling product"
        action={<FilterMenu param="bestCat" label="Category" options={options} value={category ?? "all"} />}
      />
      {rows.length === 0 ? (
        <p className="mt-6 flex-1 text-copy text-muted-foreground">No sales in this range{category ? " for this category" : ""}.</p>
      ) : (
        <>
          <div className="mt-6 hidden flex-1 overflow-x-auto tablet:block">
            <table className="w-full min-w-140 text-left">
              <thead>
                <tr className="text-copy text-muted-foreground uppercase">
                  <th scope="col" className="h-13.25 rounded-l-lg bg-secondary px-5.5 font-normal">Product</th>
                  <th scope="col" className="bg-secondary font-normal">Total order</th>
                  <th scope="col" className="bg-secondary font-normal">Status</th>
                  <th scope="col" className="rounded-r-lg bg-secondary font-normal">Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="h-16.5">
                    <td className="pl-1.5">
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 text-lead font-bold text-foreground hover:text-primary">
                        <ProductThumb src={p.imageUrl} size={36} className="size-9 bg-transparent" />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    </td>
                    <td className="text-lead text-foreground tabular-nums">{p.orders}</td>
                    <td>
                      <StockStatus available={p.available} />
                    </td>
                    <td className="text-lead font-bold text-foreground">{formatPrice(p.priceCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 flex flex-col gap-3 tablet:hidden">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/admin/products/${p.id}`} className="press flex items-center gap-3 rounded-lg border border-border p-3">
                  <ProductThumb src={p.imageUrl} size={44} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-foreground">{p.name}</span>
                    <span className="block text-caption text-muted-foreground">{p.orders} orders</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-bold text-foreground">{formatPrice(p.priceCents)}</span>
                    <StockStatus available={p.available} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-3 flex justify-end">
        <SeeMore href="/admin/products" />
      </div>
    </DashCard>
  );
}

export function BestSellingSkeleton() {
  return (
    <DashCard className="flex flex-col gap-4" aria-hidden>
      <div className="flex justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-8 w-20" />
      </div>
      <Skeleton className="h-13 w-full rounded-lg" />
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </DashCard>
  );
}
