import { connection } from "next/server";
import { Suspense } from "react";
import { Rail, RailItem } from "@/components/shared/rail";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { getHomeCategories } from "@/lib/queries/catalog";
import type { Section } from "@/lib/config/home";
import { CategoryTile } from "../category-tile";
import { SectionHeading } from "../section-heading";

/**
 * Popular Categories: a rail below laptop (28% / 20% tiles, so the next one peeks),
 * then a 6-column grid on laptop and desktop (desktop 6 × 200, gap 24).
 */
const GRID = "laptop:grid-cols-6 laptop:gap-6";

export function PopularCategories({ section }: { section: Section }) {
  return (
    <section aria-labelledby="popular-categories" className="reveal flex flex-col gap-6 tablet:gap-8">
      <SectionHeading id="popular-categories" section={section} />
      <Suspense fallback={<CategoriesSkeleton />}>
        <CategoryGrid />
      </Suspense>
    </section>
  );
}

async function CategoryGrid() {
  await connection(); // request-time render so `next build` needs no DB; the query itself is cached
  const categories = await getHomeCategories();
  if (categories.length === 0) {
    return <p className="text-copy text-muted-foreground">No categories yet.</p>;
  }
  return (
    <Rail size="category" laptop="grid" className={cn(GRID, "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500")}>
      {categories.map((c) => (
        <RailItem key={c.id}>
          <CategoryTile category={c} />
        </RailItem>
      ))}
    </Rail>
  );
}

function CategoriesSkeleton() {
  return (
    <Rail size="category" laptop="grid" className={GRID} role="status" aria-label="Loading categories">
      {Array.from({ length: 12 }, (_, i) => (
        <RailItem key={i} className="flex flex-col items-center gap-4 rounded-md border border-border px-2 pt-3 pb-6">
          <Skeleton className="aspect-[176/130] w-full" />
          <Skeleton className="h-5 w-2/3" />
        </RailItem>
      ))}
    </Rail>
  );
}
