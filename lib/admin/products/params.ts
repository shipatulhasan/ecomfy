/**
 * Product List URL state (?q=&category=&status=&stock=&brand=&sort=&page=&perPage=).
 * Pure: parsed on the server page and serialized by the client toolbar.
 */
export const PRODUCT_SORTS = ["product", "price", "sku", "qty", "category", "date", "status"] as const;
export type ProductSortKey = (typeof PRODUCT_SORTS)[number];
export const PER_PAGE = [10, 25, 50] as const;
export const STATUS_PARAMS = { draft: "DRAFT", published: "PUBLISHED", archived: "ARCHIVED" } as const;
export const STOCK_PARAMS = ["in", "low", "out"] as const;

export type ProductListParams = {
  q: string;
  category: string | null;
  status: keyof typeof STATUS_PARAMS | null;
  stock: (typeof STOCK_PARAMS)[number] | null;
  brand: string | null;
  sort: { key: ProductSortKey; dir: "asc" | "desc" };
  page: number;
  perPage: (typeof PER_PAGE)[number];
};

export const DEFAULT_SORT = { key: "date", dir: "desc" } as const;

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseProductParams(sp: Raw): ProductListParams {
  const q = one(sp.q).trim().slice(0, 100);
  const category = /^[a-z0-9-]{1,80}$/.test(one(sp.category)) ? one(sp.category) : null;
  const status = one(sp.status) in STATUS_PARAMS ? (one(sp.status) as keyof typeof STATUS_PARAMS) : null;
  const stock = (STOCK_PARAMS as readonly string[]).includes(one(sp.stock)) ? (one(sp.stock) as ProductListParams["stock"]) : null;
  const brand = one(sp.brand).trim().slice(0, 60) || null;
  const rawSort = one(sp.sort);
  const key = rawSort.replace(/^-/, "");
  const sort = (PRODUCT_SORTS as readonly string[]).includes(key)
    ? { key: key as ProductSortKey, dir: rawSort.startsWith("-") ? ("desc" as const) : ("asc" as const) }
    : DEFAULT_SORT;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one(sp.page), 10) || 1));
  const pp = Number.parseInt(one(sp.perPage), 10);
  const perPage = (PER_PAGE as readonly number[]).includes(pp) ? (pp as ProductListParams["perPage"]) : PER_PAGE[0];
  return { q, category, status, stock, brand, sort, page, perPage };
}

/** Serialize, dropping defaults. `patch` resets page unless it sets one. */
export function productParamsHref(p: ProductListParams, patch: Partial<ProductListParams> = {}): string {
  const next = { ...p, page: "page" in patch ? patch.page! : 1, ...patch };
  const s = new URLSearchParams();
  if (next.q) s.set("q", next.q);
  if (next.category) s.set("category", next.category);
  if (next.status) s.set("status", next.status);
  if (next.stock) s.set("stock", next.stock);
  if (next.brand) s.set("brand", next.brand);
  if (next.sort.key !== DEFAULT_SORT.key || next.sort.dir !== DEFAULT_SORT.dir) {
    s.set("sort", `${next.sort.dir === "desc" ? "-" : ""}${next.sort.key}`);
  }
  if (next.page > 1) s.set("page", String(next.page));
  if (next.perPage !== PER_PAGE[0]) s.set("perPage", String(next.perPage));
  const qs = s.toString();
  return `/admin/products${qs ? `?${qs}` : ""}`;
}

/** Clicking a header: same column flips direction; a new column starts ascending (date: newest first). */
export function nextSort(p: ProductListParams, key: ProductSortKey): ProductListParams["sort"] {
  if (p.sort.key === key) return { key, dir: p.sort.dir === "asc" ? "desc" : "asc" };
  return { key, dir: key === "date" ? "desc" : "asc" };
}

export const hasProductFilters = (p: ProductListParams) => Boolean(p.q || p.category || p.status || p.stock || p.brand);
