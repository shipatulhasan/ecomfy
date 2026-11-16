import { ArrowLeftIcon, ArrowRightIcon, ShapesIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Rail, RailItem } from "@/components/shared/rail";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryParamsHref, DISCOVER_TILES_PER_PAGE, type AdminCategoryRow, type CategoryListParams } from "@/lib/admin/categories/params";
import { cn } from "@/lib/utils";

/**
 * Categories.png "Discover": the top-level categories as 200×152 tiles, 5 × 2
 * from laptop with the round → arrow paging through them (?tiles=). Below laptop
 * a rail (2 / 3 tiles and a peek). Picking a tile filters the table to that
 * family (?parent=); picking it again clears it. The selected tile has the PNG's
 * green border and green name.
 */
export function DiscoverTiles({ tiles, params }: { tiles: AdminCategoryRow[]; params: CategoryListParams }) {
  if (tiles.length === 0) return null;
  const pages = Math.max(1, Math.ceil(tiles.length / DISCOVER_TILES_PER_PAGE));
  const page = Math.min(params.tiles, pages);
  const onPage = (i: number) => Math.floor(i / DISCOVER_TILES_PER_PAGE) + 1 === page;
  const arrow =
    "tap-target grid size-12 shrink-0 place-items-center rounded-full bg-card text-foreground shadow-md transition-colors hover:bg-muted";

  return (
    <nav aria-label="Filter by category" className="flex items-center gap-6">
      {pages > 1 && page > 1 && (
        <Link href={categoryParamsHref(params, { tiles: page - 1, page: params.page })} scroll={false} aria-label="Previous categories" className={cn(arrow, "hidden laptop:grid")}>
          <ArrowLeftIcon aria-hidden className="size-6" />
        </Link>
      )}
      <Rail size="product" laptop="grid" className="min-w-0 flex-1 laptop:grid-cols-5 laptop:gap-4">
        {tiles.map((t, i) => {
          const selected = params.parent === t.id;
          return (
            <RailItem key={t.id} className={cn(!onPage(i) && "laptop:hidden")}>
              <Link
                href={categoryParamsHref(params, { parent: selected ? null : t.id })}
                scroll={false}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "press group/tile flex h-38 flex-col items-center justify-center gap-3 rounded-md border bg-card px-2 text-center transition-colors",
                  selected ? "border-primary" : "border-border hover:border-primary/60",
                  !t.isActive && "opacity-60",
                )}
              >
                <span className="relative block h-20 w-full">
                  {t.imageUrl ? (
                    <Image
                      src={t.imageUrl}
                      alt=""
                      fill
                      sizes="(width >= 64rem) 200px, (width >= 48rem) 30vw, 44vw"
                      placeholder={t.blurDataURL ? "blur" : "empty"}
                      blurDataURL={t.blurDataURL ?? undefined}
                      className="object-contain transition-[scale] duration-300 motion-safe:laptop:group-hover/tile:scale-105"
                    />
                  ) : (
                    <ShapesIcon aria-hidden className="mx-auto size-full p-4 text-muted-foreground" />
                  )}
                </span>
                <span className={cn("line-clamp-1 text-h4 font-medium", selected ? "text-primary" : "text-foreground")}>
                  {t.name}
                  {!t.isActive && <span className="sr-only"> (inactive)</span>}
                </span>
              </Link>
            </RailItem>
          );
        })}
      </Rail>
      {pages > 1 && (
        <Link
          href={categoryParamsHref(params, { tiles: page < pages ? page + 1 : 1, page: params.page })}
          scroll={false}
          aria-label={page < pages ? "Next categories" : "First categories"}
          className={cn(arrow, "hidden laptop:grid")}
        >
          <ArrowRightIcon aria-hidden className="size-6" />
        </Link>
      )}
    </nav>
  );
}

export function DiscoverTilesSkeleton() {
  return (
    <Rail size="product" laptop="grid" className="laptop:mr-18 laptop:grid-cols-5 laptop:gap-4" role="status" aria-label="Loading categories">
      {Array.from({ length: 10 }, (_, i) => (
        <RailItem key={i} className="flex h-38 flex-col items-center justify-center gap-3 rounded-md border border-border bg-card px-4">
          <Skeleton className="h-20 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
        </RailItem>
      ))}
    </Rail>
  );
}
