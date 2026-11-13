import { Rail, RailItem } from "@/components/shared/rail";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Product layouts.
 *
 * - <ProductGrid>: a plain grid at every layer.
 *   - `borders="shared"` (Home PNG): 1px shared borders; children get -mt-px/-ml-px
 *     and the padding here compensates.
 *   - `borders="gap"` (Shop PNG): separate rounded cards with gaps.
 * - <ProductRail>: Home sections. A scroll-snap rail of separate cards below laptop
 *   and the shared-border grid (5 columns) from laptop up.
 *
 * Columns per layer: 2 / 3 / 5 / 5 (Home), 2 / 3 / 4 / 4 (Product 4x) or
 * 2 / 3 / 3 / 3 (Shop, beside the filter sidebar).
 */
const columns = {
  home: "grid-cols-2 tablet:grid-cols-3 laptop:grid-cols-5",
  shop: "grid-cols-2 tablet:grid-cols-3 laptop:grid-cols-4",
  sidebar: "grid-cols-2 tablet:grid-cols-3",
} as const;

type Layout = keyof typeof columns;

const borderModes = {
  shared: "pt-px pl-px *:-mt-px *:-ml-px",
  gap: "gap-3 tablet:gap-4 laptop:gap-6",
} as const;

export function ProductGrid({
  layout = "home",
  borders = "shared",
  className,
  children,
  ...props
}: { layout?: Layout; borders?: keyof typeof borderModes } & React.ComponentProps<"div">) {
  return (
    <div className={cn("grid", columns[layout], borderModes[borders], className)} {...props}>
      {children}
    </div>
  );
}

/** Rail below laptop, shared-border 5-column Home grid from laptop. Children: <ProductRailItem>. */
export function ProductRail({ className, ...props }: React.ComponentProps<typeof Rail>) {
  return (
    <Rail
      size="product"
      laptop="grid"
      className={cn("laptop:grid-cols-5 laptop:gap-0 laptop:pt-px laptop:pl-px", className)}
      {...props}
    />
  );
}

export function ProductRailItem({ className, ...props }: React.ComponentProps<"li">) {
  return <RailItem className={cn("laptop:-mt-px laptop:-ml-px", className)} {...props} />;
}

/** Card classes inside a ProductRail: rounded separate cards below laptop, square shared cells above. */
export const RAIL_CARD = "rounded-lg laptop:rounded-none";

/** Spotlight cell (Hot Deals): 2 columns × 2 rows in the laptop+ grid, a wide rail item below. */
export const SPOTLIGHT_CELL = "w-[88%] tablet:w-[60%] laptop:col-span-2 laptop:row-span-2 laptop:w-auto";

const COLUMNS: Record<Layout, readonly [number, number, number, number]> = {
  home: [2, 3, 5, 5],
  shop: [2, 3, 4, 4],
  sidebar: [2, 3, 3, 3],
};
// Literal class names so Tailwind generates them.
const SHOW = ["block", "tablet:block", "laptop:block", "desktop:block"] as const;
const HIDE = ["hidden", "tablet:hidden", "laptop:hidden", "desktop:hidden"] as const;

/**
 * Per-item classes that hide the items which would leave a partial last row on each
 * layer (e.g. 10 products → 10 / 9 / 10 / 10). CSS only, no width detection. Apply
 * them to the grid cell (the <li>).
 *
 * - `leadCells`: cells taken before the items (4 for a spotlight card).
 * - `fromLayer`: first layer that is a grid. Use 2 for a rail below laptop, where
 *   every item stays visible.
 */
export function fullRowClasses(
  count: number,
  { layout = "home", leadCells = 0, fromLayer = 0 } = {} as {
    layout?: Layout;
    leadCells?: number;
    fromLayer?: number;
  },
): string[] {
  const keep = COLUMNS[layout].map((cols, layer) => {
    if (layer < fromLayer) return count;
    const cells = leadCells + count;
    const full = Math.max(cols, Math.floor(cells / cols) * cols);
    return Math.min(count, full - leadCells);
  });
  return Array.from({ length: count }, (_, i) => {
    let prev = true; // shown by default
    const out: string[] = [];
    keep.forEach((k, layer) => {
      const visible = i < k;
      if (visible !== prev || (layer === 0 && !visible)) out.push(visible ? SHOW[layer]! : HIDE[layer]!);
      prev = visible;
    });
    return out.join(" ");
  });
}

export function ProductCardSkeleton({ spotlight = false, className }: { spotlight?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("flex h-full flex-col border border-border bg-card", className)}>
      <div className={spotlight ? "flex-1 px-6 pt-16" : "p-1.25"}>
        <Skeleton className={cn("w-full", spotlight ? "aspect-[480/290]" : "aspect-[254/240]")} />
      </div>
      {spotlight ? (
        <div className="flex flex-col items-center gap-3 px-6 pt-2 pb-6">
          <Skeleton className="h-11 w-full rounded-full" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-2/3" />
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 pb-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="size-10 rounded-full" />
        </div>
      )}
    </div>
  );
}

/** Skeleton for a <ProductRail> section (same rail/grid geometry as the real thing). */
export function ProductRailSkeleton({ count, spotlight = false }: { count: number; spotlight?: boolean }) {
  const fit = fullRowClasses(count, { leadCells: spotlight ? 4 : 0, fromLayer: 2 });
  return (
    <ProductRail role="status" aria-label="Loading products" className={cn(spotlight && "items-start laptop:items-stretch")}>
      {spotlight && (
        <ProductRailItem className={SPOTLIGHT_CELL}>
          <ProductCardSkeleton spotlight className={RAIL_CARD} />
        </ProductRailItem>
      )}
      {Array.from({ length: count }, (_, i) => (
        <ProductRailItem key={i} className={fit[i]}>
          <ProductCardSkeleton className={RAIL_CARD} />
        </ProductRailItem>
      ))}
    </ProductRail>
  );
}

/** Skeleton for a <ProductGrid>. */
export function ProductGridSkeleton({
  count,
  layout = "home",
  borders = "shared",
}: {
  count: number;
  layout?: Layout;
  borders?: keyof typeof borderModes;
}) {
  return (
    <ProductGrid layout={layout} borders={borders} role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} className={borders === "gap" ? "rounded-lg" : undefined} />
      ))}
    </ProductGrid>
  );
}
