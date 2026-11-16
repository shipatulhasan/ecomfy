import { ChevronRightIcon, CirclePlusIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/money";
import { getAddNewProduct } from "@/lib/queries/admin/dashboard";
import { DashCard, DashCardHeader, SeeMore } from "./dash-card";
import { ProductThumb } from "./product-thumb";

/**
 * "Add New Product" (366×617): shortcut to the product form, the 3 biggest
 * categories, and products waiting to be published (drafts; the newest products
 * when there are none). "Add" opens the product to finish and publish it — the
 * card itself changes nothing.
 */
export async function AddNewProduct() {
  const { categories, products } = await getAddNewProduct();
  return (
    <DashCard aria-labelledby="add-title" className="flex flex-col">
      <DashCardHeader
        titleId="add-title"
        title="Add New Product"
        action={
          <Link href="/admin/products/new" className="tap-target inline-flex items-center gap-1 text-copy text-info hover:underline">
            <CirclePlusIcon aria-hidden className="size-5" /> Add New
          </Link>
        }
      />
      <p className="mt-4 text-copy text-text-body">Categories</p>
      <ul className="mt-5 flex flex-col gap-4">
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/admin/categories/${c.slug}`}
              className="press flex items-center gap-3 rounded-lg border border-border p-1.5 pr-4 shadow-xs hover:border-primary"
            >
              <span className="relative size-13 shrink-0 overflow-hidden rounded-md bg-muted">
                {c.imageUrl && <Image src={c.imageUrl} alt="" fill sizes="52px" className="object-contain p-1" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-lead text-foreground">{c.name}</span>
              <span className="sr-only">, {c.products} products</span>
              <ChevronRightIcon aria-hidden className="size-5 text-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <SeeMore href="/admin/categories" className="mx-auto mt-3" />

      <p className="mt-4 text-copy text-text-body">Product</p>
      <ul className="mt-3 flex flex-col">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-3 border-b border-border py-3">
            <ProductThumb src={p.imageUrl} size={48} className="size-12 border border-border" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-copy text-foreground">{p.name}</span>
              <span className="mt-0.5 block text-copy text-primary">{formatPrice(p.priceCents)}</span>
            </span>
            <Link
              href={`/admin/products/${p.id}`}
              aria-label={`Add ${p.name}`}
              className="press inline-flex h-7.5 shrink-0 items-center gap-1 rounded-full bg-primary px-3 text-caption text-primary-foreground hover:bg-primary-hover"
            >
              <CirclePlusIcon aria-hidden className="size-4" /> Add
            </Link>
          </li>
        ))}
      </ul>
      <SeeMore href="/admin/products" className="mx-auto mt-3" />
    </DashCard>
  );
}

export function AddNewProductSkeleton() {
  return (
    <DashCard className="flex flex-col gap-4" aria-hidden>
      <Skeleton className="h-6 w-40" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={`p${i}`} className="h-12 w-full" />
      ))}
    </DashCard>
  );
}
