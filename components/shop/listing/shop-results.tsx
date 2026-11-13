import { SearchXIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { shopContent } from "@/lib/config/shop";
import { getShopProducts } from "@/lib/queries/products";
import { hasActiveFilters, pageHref, shopHref, type ShopFilters } from "@/lib/shop-params";
import { ProductCard } from "../product-card";
import { ProductGrid } from "../product-grid";
import { ShopPagination } from "./shop-pagination";

/** Columns on desktop/laptop: the first row loads eagerly, the rest lazily. */
const FIRST_ROW = 3;

/**
 * Product grid + pagination for the current filters. Streams inside a Suspense
 * boundary keyed on the query string, so every filter change shows the skeleton.
 * A page past the end redirects to the last page (streamed → client-side redirect).
 */
export async function ShopResults({ filters }: { filters: ShopFilters }) {
  const { products, total, totalPages } = await getShopProducts(filters);

  if (filters.page > 1 && filters.page > totalPages) {
    redirect(total > 0 ? pageHref(filters, totalPages) : shopHref({ ...filters, page: 1 }));
  }
  if (total === 0) return <EmptyResults filters={filters} />;

  return (
    <div className="flex flex-col gap-8 laptop:gap-10">
      <ProductGrid layout="sidebar" borders="gap" className="laptop:group-data-[sidebar=closed]/shop:grid-cols-4">
        {products.map((p, i) => (
          <ProductCard key={p.id} product={p} variant="framed" imageLoading={i < FIRST_ROW ? "eager" : undefined} />
        ))}
      </ProductGrid>
      <ShopPagination filters={filters} totalPages={totalPages} />
    </div>
  );
}

/** "52 Results Found" (same cached query as the grid, deduped per request). */
export async function ResultCount({ filters }: { filters: ShopFilters }) {
  const { total } = await getShopProducts(filters);
  return (
    <p className="text-copy text-text-body tablet:text-lead" aria-live="polite">
      <strong className="font-semibold text-foreground">{total}</strong>{" "}
      {total === 1 ? shopContent.results.singular : shopContent.results.suffix}
    </p>
  );
}

function EmptyResults({ filters }: { filters: ShopFilters }) {
  const t = shopContent.empty;
  // Keep the category when other filters are what emptied the list.
  const onlyCategory = !hasActiveFilters({ ...filters, category: undefined });
  const href = onlyCategory ? shopHref({}) : shopHref({ category: filters.category });
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border px-6 py-16 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-secondary text-brand-dark">
        <SearchXIcon aria-hidden className="size-7" />
      </span>
      <h2 className="text-h3">{t.title}</h2>
      <p className="max-w-sm text-copy text-muted-foreground">{t.description}</p>
      <Link
        href={href}
        replace
        scroll={false}
        className="press mt-2 inline-flex h-11 items-center rounded-full bg-primary px-8 text-copy font-semibold text-primary-foreground transition-colors hover:bg-brand-dark"
      >
        {onlyCategory ? shopContent.notFound.cta : t.cta}
      </Link>
    </div>
  );
}
