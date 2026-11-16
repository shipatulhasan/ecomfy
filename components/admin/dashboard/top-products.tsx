import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import type { DateRange } from "@/lib/admin/date-range";
import { formatPrice } from "@/lib/money";
import { getTopProducts } from "@/lib/queries/admin/dashboard";
import { DashCard, DashCardHeader } from "./dash-card";
import { TopProductsList } from "./top-products-list";

/** "Top Products" (366×457): search + the range's best sellers by units, scrolling inside the card. */
export async function TopProducts({ range }: { range: DateRange }) {
  const products = await getTopProducts(range);
  return (
    <DashCard aria-labelledby="top-title" className="flex flex-col">
      <DashCardHeader
        titleId="top-title"
        title="Top Products"
        action={
          <Link href="/admin/products" className="tap-target text-caption text-primary hover:underline">
            All product
          </Link>
        }
      />
      <TopProductsList
        products={products.map((p) => ({ id: p.id, name: p.name, code: p.sku, imageUrl: p.imageUrl, price: formatPrice(p.priceCents), units: p.units }))}
      />
    </DashCard>
  );
}

export function TopProductsSkeleton() {
  return (
    <DashCard className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-full" />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-lg" />
          <Skeleton className="h-10 flex-1" />
        </div>
      ))}
    </DashCard>
  );
}
