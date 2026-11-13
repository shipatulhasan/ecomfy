import { XIcon } from "lucide-react";
import Link from "next/link";
import { Rail, RailItem } from "@/components/shared/rail";
import { shopContent } from "@/lib/config/shop";
import { formatPriceWhole } from "@/lib/money";
import { hasActiveFilters, shopHref, type ShopFilters } from "@/lib/shop-params";
import { cn } from "@/lib/utils";

/**
 * Removable chips for the active filters + "Clear all". Plain links to the URL
 * without that filter (no client JS); replace + scroll={false} like the controls.
 * A scrolling rail below laptop, wrapping chips from laptop up.
 */
export function ActiveFilters({ filters, categoryName }: { filters: ShopFilters; categoryName?: string }) {
  if (!hasActiveFilters(filters)) return null;
  const base: ShopFilters = { ...filters, page: 1 };
  const chips: { key: string; label: string; href: string }[] = [];

  if (filters.category) chips.push({ key: "category", label: categoryName ?? filters.category, href: shopHref({ ...base, category: undefined }) });
  if (filters.q) chips.push({ key: "q", label: `“${filters.q}”`, href: shopHref({ ...base, q: undefined }) });
  if (filters.min != null || filters.max != null) {
    const lo = filters.min != null ? formatPriceWhole(filters.min * 100) : "";
    const hi = filters.max != null ? formatPriceWhole(filters.max * 100) : "";
    const label = lo && hi ? `${lo} — ${hi}` : lo ? `From ${lo}` : `Up to ${hi}`;
    chips.push({ key: "price", label, href: shopHref({ ...base, min: undefined, max: undefined }) });
  }
  if (filters.rating) chips.push({ key: "rating", label: filters.rating === 5 ? "5.0 stars" : `${filters.rating}.0 & up`, href: shopHref({ ...base, rating: undefined }) });
  for (const tag of filters.tags) chips.push({ key: `tag:${tag}`, label: tag, href: shopHref({ ...base, tags: filters.tags.filter((t) => t !== tag) }) });
  for (const brand of filters.brands) chips.push({ key: `brand:${brand}`, label: brand, href: shopHref({ ...base, brands: filters.brands.filter((b) => b !== brand) }) });
  if (filters.inStock) chips.push({ key: "stock", label: shopContent.filters.inStock, href: shopHref({ ...base, inStock: false }) });

  return (
    <div className="flex flex-col gap-2 laptop:flex-row laptop:items-center laptop:gap-3">
      <p className="text-copy text-muted-foreground">{shopContent.filters.active}</p>
      <Rail size="chip" laptop="grid" className="items-center laptop:flex laptop:flex-wrap laptop:gap-2">
        {chips.map((c) => (
          <RailItem key={c.key}>
            <Link
              href={c.href}
              replace
              scroll={false}
              aria-label={`Remove filter: ${c.label}`}
              className={cn(
                "press tap-target inline-flex items-center gap-1.5 rounded-full bg-secondary py-1.5 pr-2.5 pl-4 text-copy whitespace-nowrap text-brand-dark transition-colors",
                "hover:bg-primary hover:text-primary-foreground",
              )}
            >
              {c.label}
              <XIcon aria-hidden className="size-4" />
            </Link>
          </RailItem>
        ))}
        <RailItem>
          <Link
            href={shopHref({})}
            replace
            scroll={false}
            className="press tap-target inline-flex items-center px-2 text-copy font-medium whitespace-nowrap text-primary underline-offset-4 hover:underline"
          >
            {shopContent.filters.clearAll}
          </Link>
        </RailItem>
      </Rail>
    </div>
  );
}
