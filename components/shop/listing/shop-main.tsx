import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCategoryBySlug } from "@/lib/queries/products";
import { shopHref, toSearchParams } from "@/lib/shop-params";
import { parseShopParams } from "@/lib/validations/shop";
import { ActiveFilters } from "./active-filters";
import { FilterPanel } from "./filter-panel";
import { FilterSheet } from "./filter-sheet";
import { SortSelect } from "./filters";
import { ShopAside } from "./shop-aside";
import { ResultCount, ShopResults } from "./shop-results";
import { COUNT_SKELETON, FilterPanelSkeleton, ResultsSkeleton } from "./skeletons";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Request-time part of the Shop page (inside <Suspense>): reads and validates the
 * search params, then renders the toolbar ([grid-area:toolbar]) and the results
 * ([grid-area:main]) of <ShopShell>.
 *
 * - malformed ?page → redirect to the same URL without it
 * - unknown ?category → notFound()
 * - count and grid stream in boundaries keyed on the query string, so each filter
 *   change shows the skeleton instead of stale cards.
 */
export async function ShopMain({ searchParams }: { searchParams: SearchParams }) {
  const { filters, pageInvalid } = parseShopParams(await searchParams);
  if (pageInvalid) redirect(shopHref({ ...filters, page: 1 }));

  const category = filters.category ? await getCategoryBySlug(filters.category) : null;
  if (filters.category && !category) notFound();

  const key = toSearchParams(filters).toString();

  return (
    <>
      <div
        className={
          // Sticky under the compact header below laptop (app shell); static from laptop.
          "sticky top-(--app-header-h) z-30 -mx-gutter flex flex-col gap-3 bg-background/85 px-gutter py-2 backdrop-blur-md [grid-area:toolbar] " +
          "laptop:static laptop:mx-0 laptop:bg-transparent laptop:px-0 laptop:py-0 laptop:backdrop-blur-none"
        }
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 tablet:flex-nowrap tablet:gap-6 laptop:justify-between">
          <FilterSheet className="press">
            <Suspense fallback={<FilterPanelSkeleton />}>
              <FilterPanel />
            </Suspense>
          </FilterSheet>
          <SortSelect className="flex-1 tablet:flex-none" />
          <div className="w-full tablet:ml-auto tablet:w-auto">
            <Suspense key={key} fallback={COUNT_SKELETON}>
              <ResultCount filters={filters} />
            </Suspense>
          </div>
        </div>
        {/* Below laptop the chips stay in the sticky toolbar. */}
        <div className="laptop:hidden">
          <ActiveFilters filters={filters} categoryName={category?.name} />
        </div>
      </div>

      <div className="flex flex-col gap-section [grid-area:main]">
        {/* Laptop+: chips open the main column, so the toolbar row stays the PNG's 45px. */}
        <div className="-mb-2 hidden laptop:block empty:hidden">
          <ActiveFilters filters={filters} categoryName={category?.name} />
        </div>
        <Suspense key={key} fallback={<ResultsSkeleton />}>
          <ShopResults filters={filters} />
        </Suspense>
        <ShopAside className="laptop:hidden" />
      </div>
    </>
  );
}
