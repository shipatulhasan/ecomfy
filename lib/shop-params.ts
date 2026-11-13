/**
 * Shop listing URL state. The URL is the source of truth for every filter:
 *   /shop?category=fresh-vegetables&min=10&max=40&rating=4&tag=Low+fat&brand=Farmary&stock=in&sort=price-asc&page=2
 *
 * Client-safe (no zod, no server imports): filter components, chips and pagination
 * all build URLs with these helpers. Parsing/validation lives in lib/validations/shop.ts.
 */

export const SHOP_PATH = "/shop";
export const SHOP_PAGE_SIZE = 15; // Shop.png: 3 columns × 5 rows

export const SHOP_SORTS = ["latest", "popular", "rating", "price-asc", "price-desc", "name"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];
export const DEFAULT_SORT: ShopSort = "latest";

/** Validated filters. Prices are whole dollars (the URL is human-readable); the query converts to cents. */
export type ShopFilters = {
  category?: string;
  q?: string;
  min?: number;
  max?: number;
  rating?: number;
  tags: string[];
  brands: string[];
  inStock: boolean;
  sort: ShopSort;
  page: number;
};

/** URL keys. Repeated keys (tag, brand) are multi-select. */
export const ShopParam = {
  category: "category",
  q: "q",
  min: "min",
  max: "max",
  rating: "rating",
  tag: "tag",
  brand: "brand",
  stock: "stock",
  sort: "sort",
  page: "page",
} as const;

/** Canonical query string for a filter set: stable key order, defaults omitted. */
export function toSearchParams(f: Partial<ShopFilters>): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.category) sp.set(ShopParam.category, f.category);
  if (f.q) sp.set(ShopParam.q, f.q);
  if (f.min != null) sp.set(ShopParam.min, String(f.min));
  if (f.max != null) sp.set(ShopParam.max, String(f.max));
  if (f.rating) sp.set(ShopParam.rating, String(f.rating));
  for (const t of f.tags ?? []) sp.append(ShopParam.tag, t);
  for (const b of f.brands ?? []) sp.append(ShopParam.brand, b);
  if (f.inStock) sp.set(ShopParam.stock, "in");
  if (f.sort && f.sort !== DEFAULT_SORT) sp.set(ShopParam.sort, f.sort);
  if (f.page && f.page > 1) sp.set(ShopParam.page, String(f.page));
  return sp;
}

export function shopHref(f: Partial<ShopFilters>): string {
  const qs = toSearchParams(f).toString();
  return qs ? `${SHOP_PATH}?${qs}` : SHOP_PATH;
}

/** Same filters, different page (pagination links). */
export function pageHref(f: ShopFilters, page: number): string {
  return shopHref({ ...f, page });
}

/** Any filter (not sort/page) active? Drives the chips row and the empty state copy. */
export function hasActiveFilters(f: ShopFilters): boolean {
  return Boolean(
    f.category || f.q || f.min != null || f.max != null || f.rating || f.tags.length || f.brands.length || f.inStock,
  );
}

/**
 * Pagination window: 1 2 3 4 5 … 21 (Shop.png). `siblings` pages either side of the
 * current one, first/last always shown, gaps as "ellipsis".
 */
export function pageWindow(current: number, total: number, siblings = 1): (number | "ellipsis")[] {
  if (total <= 1) return total === 1 ? [1] : [];
  const slots = siblings * 2 + 5; // first, last, current, 2 ellipses
  if (total <= slots) return Array.from({ length: total }, (_, i) => i + 1);
  const left = Math.max(current - siblings, 2);
  const right = Math.min(current + siblings, total - 1);
  const showLeftGap = left > 3;
  const showRightGap = right < total - 2;
  if (!showLeftGap) {
    const end = 3 + siblings * 2;
    return [...Array.from({ length: end }, (_, i) => i + 1), "ellipsis", total];
  }
  if (!showRightGap) {
    const start = total - (2 + siblings * 2);
    return [1, "ellipsis", ...Array.from({ length: total - start + 1 }, (_, i) => start + i)];
  }
  return [1, "ellipsis", ...Array.from({ length: right - left + 1 }, (_, i) => left + i), "ellipsis", total];
}
