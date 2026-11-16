/**
 * Admin → Categories URL state (?q=&status=&parent=&page=&tiles=). Pure: parsed on
 * the server page, serialized by the client toolbar. The modal state (?modal=new,
 * ?edit=<id>) rides on the same URL but is read and written separately
 * (components/admin/categories/use-category-modal.ts), so opening the modal never
 * re-renders the list.
 */

export const CATEGORY_STATUS_TABS = ["all", "featured", "active", "inactive"] as const;
export type CategoryStatusTab = (typeof CATEGORY_STATUS_TABS)[number];

/** Top-level families per page (each with its subcategories). */
export const CATEGORY_FAMILIES_PER_PAGE = 10;
/** Discover tiles per page on laptop+ (Categories.png: 5 × 2, then the → arrow). */
export const DISCOVER_TILES_PER_PAGE = 10;

export type CategoryListParams = {
  q: string;
  status: CategoryStatusTab;
  /** Top-level category id: the selected Discover tile. */
  parent: string | null;
  page: number;
  /** Discover tiles page (laptop+). */
  tiles: number;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const int = (v: string, max: number) => Math.max(1, Math.min(max, Number.parseInt(v, 10) || 1));

export function parseCategoryParams(sp: Raw): CategoryListParams {
  const status = one(sp.status);
  const parent = one(sp.parent);
  return {
    q: one(sp.q).trim().slice(0, 100),
    status: (CATEGORY_STATUS_TABS as readonly string[]).includes(status) ? (status as CategoryStatusTab) : "all",
    parent: /^[A-Za-z0-9_-]{1,40}$/.test(parent) ? parent : null,
    page: int(one(sp.page), 10_000),
    tiles: int(one(sp.tiles), 1_000),
  };
}

/** Serialize, dropping defaults. `patch` resets the list page unless it sets one. */
export function categoryParamsHref(p: CategoryListParams, patch: Partial<CategoryListParams> = {}): string {
  const next = { ...p, page: "page" in patch ? patch.page! : 1, ...patch };
  const s = new URLSearchParams();
  if (next.q) s.set("q", next.q);
  if (next.status !== "all") s.set("status", next.status);
  if (next.parent) s.set("parent", next.parent);
  if (next.page > 1) s.set("page", String(next.page));
  if (next.tiles > 1) s.set("tiles", String(next.tiles));
  const qs = s.toString();
  return `/admin/categories${qs ? `?${qs}` : ""}`;
}

export const hasCategoryFilters = (p: CategoryListParams) => Boolean(p.q || p.status !== "all" || p.parent);

/** Reordering needs the unfiltered sibling order on screen. */
export const canReorderView = (p: CategoryListParams) => !p.q && p.status === "all";

/** One row of the Categories table / card list (plain data, crosses to the client). */
export type AdminCategoryRow = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  description: string;
  imageId: string | null;
  imageUrl: string | null;
  imageAlt: string;
  blurDataURL: string | null;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  seoTitle: string;
  seoDescription: string;
  /** Live products (not deleted) directly in this category. */
  productCount: number;
  childCount: number;
  createdAt: string; // ISO
};

/** A top-level category and the subcategories that match the current view. */
export type AdminCategoryFamily = AdminCategoryRow & {
  children: AdminCategoryRow[];
  /** false: shown only as the parent of a matching subcategory (dimmed). */
  matches: boolean;
};

export type AdminCategoryPage = {
  families: AdminCategoryFamily[];
  page: number;
  pages: number;
  /** Families matching the filters (all pages). */
  total: number;
  counts: Record<CategoryStatusTab, number>;
};

export type ParentOption = { id: string; name: string; childCount: number };
