import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { shopContent } from "@/lib/config/shop";
import { getSaleProducts } from "@/lib/queries/products";
import { cn } from "@/lib/utils";
import { ProductCard } from "../product-card";
import { SaleProductsSkeleton } from "./skeletons";
import { laptopSizes } from "@/lib/image-sizes";

/**
 * Sidebar marketing under the filters (Shop.png): "79% Discount" banner + "Sale
 * Products". In the sidebar from laptop; below the pagination on mobile/tablet
 * (stacked, then banner | list on tablet).
 */
export function ShopAside({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-6 tablet:grid tablet:grid-cols-2 laptop:flex", className)}>
      <DiscountBanner />
      <Suspense fallback={<SaleProductsSkeleton />}>
        <SaleProducts />
      </Suspense>
    </div>
  );
}

function DiscountBanner() {
  const d = shopContent.discount;
  return (
    <Link
      href={d.cta.href}
      className="group/banner press relative isolate flex aspect-[312/295] flex-col items-center overflow-hidden rounded-lg bg-muted-strong pt-5 text-center"
    >
      <Image src={d.image.url} alt="" fill sizes={`${laptopSizes(312)}, (width >= 48rem) 50vw, 100vw`} className="-z-10 object-cover" />
      <span className="text-h2 font-normal text-foreground">
        <strong className="font-semibold text-warning">{d.highlight}</strong> {d.title}
      </span>
      <span className="mt-1 text-lead text-text-body">{d.subtitle}</span>
      <span className="mt-3 inline-flex items-center gap-2 text-lead font-semibold text-primary group-hover/banner:underline">
        {d.cta.label}
        <ArrowRightIcon aria-hidden className="size-5" />
      </span>
    </Link>
  );
}

async function SaleProducts() {
  await connection();
  const products = await getSaleProducts(3);
  if (products.length === 0) return null;
  return (
    <section aria-labelledby="sale-products" className="flex flex-col gap-4">
      <h2 id="sale-products" className="text-h4 font-medium">
        {shopContent.saleProducts}
      </h2>
      <ul className="flex flex-col gap-4">
        {products.map((p) => (
          <li key={p.id}>
            <ProductCard product={p} variant="compact" />
          </li>
        ))}
      </ul>
    </section>
  );
}
