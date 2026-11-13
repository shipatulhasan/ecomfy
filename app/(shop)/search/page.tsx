import { SearchIcon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { PageTransition } from "@/components/shared/page-transition";
import { CategoryTile } from "@/components/shop/category-tile";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategories } from "@/lib/queries/catalog";

export const metadata: Metadata = { title: "Search" };

/**
 * Search tab. There is no design; this is derived and recorded in designs/DESIGN.md.
 * It's reached from the tab bar and the header search icon below laptop. Laptop and
 * desktop search inline in the header, but the page still works at every width.
 *
 * A plain GET form to /shop?q= (works without JS), then browse by category.
 */
export default function SearchPage() {
  return (
    <PageTransition>
      <Container className="flex flex-col gap-section py-6 laptop:py-section">
        <div className="flex flex-col gap-4">
          <h1 className="text-h1">Search</h1>
          <form action="/shop" role="search">
            <label className="flex h-12 w-full items-center gap-2 rounded-full border border-border bg-card px-4 focus-within:border-primary">
              <span className="sr-only">Search products</span>
              <SearchIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <input
                type="search"
                name="q"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Search fruit, vegetables, snacks…"
                className="min-w-0 flex-1 bg-transparent text-lead text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          </form>
        </div>

        <section aria-labelledby="browse-categories" className="flex flex-col gap-4">
          <h2 id="browse-categories" className="text-h3">
            Browse categories
          </h2>
          <Suspense fallback={<CategoryGridSkeleton />}>
            <CategoryGrid />
          </Suspense>
        </section>
      </Container>
    </PageTransition>
  );
}

const GRID = "grid grid-cols-3 gap-3 tablet:grid-cols-4 tablet:gap-4 laptop:grid-cols-6 laptop:gap-6";

async function CategoryGrid() {
  await connection(); // request-time render so `next build` needs no DB; the query itself is cached
  const categories = await getCategories();
  if (categories.length === 0) return <p className="text-copy text-muted-foreground">No categories yet.</p>;
  return (
    <ul className={GRID}>
      {categories.map((c) => (
        <li key={c.id}>
          <CategoryTile category={c} />
        </li>
      ))}
    </ul>
  );
}

function CategoryGridSkeleton() {
  return (
    <ul className={GRID} role="status" aria-label="Loading categories">
      {Array.from({ length: 12 }, (_, i) => (
        <li key={i} className="flex flex-col items-center gap-4 rounded-md border border-border px-2 pt-3 pb-6">
          <Skeleton className="aspect-[176/130] w-full" />
          <Skeleton className="h-5 w-2/3" />
        </li>
      ))}
    </ul>
  );
}
