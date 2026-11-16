import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { CacheTags } from "@/lib/cache-tags";
import type { Prisma } from "@/lib/generated/prisma/client";
import { SHOP_PAGE_SIZE, type ShopFilters, type ShopSort } from "@/lib/shop-params";
import { productCardSelect, toCards, visibleCategoryWhere, type ProductCardData } from "./catalog";

/**
 * Shop listing reads. Filtering, sorting and pagination all run in Postgres.
 * Everything is "use cache" + tagged `products` (and `categories` where relevant),
 * so admin mutations invalidate it with updateTag(CacheTags.products).
 * Filters arrive already validated (lib/validations/shop.ts); they are plain data,
 * so they form the cache key.
 */

const ORDER_BY: Record<ShopSort, Prisma.ProductOrderByWithRelationInput[]> = {
  latest: [{ createdAt: "desc" }, { id: "asc" }],
  popular: [{ reviewCount: "desc" }, { ratingAvg: "desc" }, { id: "asc" }],
  rating: [{ ratingAvg: "desc" }, { reviewCount: "desc" }, { id: "asc" }],
  "price-asc": [{ priceCents: "asc" }, { id: "asc" }],
  "price-desc": [{ priceCents: "desc" }, { id: "asc" }],
  name: [{ name: "asc" }, { id: "asc" }],
};

function shopWhere(f: ShopFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = { status: "PUBLISHED" };
  // A parent category includes its subcategories' products.
  if (f.category) where.category = { OR: [{ slug: f.category }, { parent: { slug: f.category } }] };
  if (f.q) where.name = { contains: f.q, mode: "insensitive" };
  if (f.min != null || f.max != null) {
    where.priceCents = {
      ...(f.min != null && { gte: f.min * 100 }),
      ...(f.max != null && { lte: f.max * 100 }),
    };
  }
  if (f.rating) where.ratingAvg = { gte: f.rating };
  if (f.tags.length) where.tags = { hasSome: f.tags };
  if (f.brands.length) where.brand = { in: f.brands };
  // Cards show (and add to cart) the default variant, so availability follows it.
  if (f.inStock) where.variants = { some: { isDefault: true, stock: { gt: 0 } } };
  return where;
}

export type ShopPage = {
  products: ProductCardData[];
  total: number;
  page: number;
  totalPages: number;
};

/**
 * One page of results. React `cache` dedupes the call per request (the result count
 * and the grid stream separately but pass the same filters object); "use cache"
 * shares it across requests.
 */
export function getShopProducts(filters: ShopFilters): Promise<ShopPage> {
  return loadShopPageOnce(JSON.stringify(filters));
}
// Keyed by a string: React cache can't key a "use cache" call on an object argument.
const loadShopPageOnce = cache((json: string) => loadShopPage(JSON.parse(json) as ShopFilters));

async function loadShopPage(filters: ShopFilters): Promise<ShopPage> {
  "use cache";
  cacheTag(CacheTags.products);
  cacheLife("hours");

  const where = shopWhere(filters);
  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: ORDER_BY[filters.sort],
      skip: (filters.page - 1) * SHOP_PAGE_SIZE,
      take: SHOP_PAGE_SIZE,
      select: productCardSelect,
    }),
  ]);
  return {
    products: toCards(rows),
    total,
    page: filters.page,
    totalPages: Math.ceil(total / SHOP_PAGE_SIZE),
  };
}

// ───────────────────────── filter options ─────────────────────────

export type ShopFilterOptions = {
  categories: { slug: string; name: string; count: number; depth: 0 | 1 }[];
  /** Whole dollars, floor/ceil of the catalog's default-variant prices. */
  price: { min: number; max: number };
  tags: { tag: string; count: number }[];
  brands: { brand: string; count: number }[];
};

const POPULAR_TAG_LIMIT = 13; // Shop.png "Popular Tag"

/** Sidebar option lists + counts, straight from the DB (not filter-dependent, so cacheable). */
export async function getShopFilterOptions(): Promise<ShopFilterOptions> {
  "use cache";
  cacheTag(CacheTags.products, CacheTags.categories);
  cacheLife("hours");

  const active = { status: "PUBLISHED" } as const;
  const [categories, perCategory, price, tags, brands] = await Promise.all([
    prisma.category.findMany({
      where: visibleCategoryWhere,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, parentId: true },
    }),
    prisma.product.groupBy({ by: ["categoryId"], where: active, _count: { _all: true } }),
    prisma.product.aggregate({ where: active, _min: { priceCents: true }, _max: { priceCents: true } }),
    prisma.$queryRaw<{ tag: string; count: number }[]>`
      SELECT t AS tag, COUNT(*)::int AS count
      FROM "Product", unnest("tags") AS t
      WHERE "status" = 'PUBLISHED'
      GROUP BY t
      ORDER BY count DESC, t ASC
      LIMIT ${POPULAR_TAG_LIMIT}`,
    prisma.product.groupBy({
      by: ["brand"],
      where: { ...active, brand: { not: null } },
      _count: { _all: true },
      orderBy: { brand: "asc" },
    }),
  ]);

  const counts = new Map(perCategory.map((c) => [c.categoryId, c._count._all]));
  return {
    // Tree order (parent, then its children, indented); a parent counts its children's products.
    categories: categories
      .filter((c) => c.parentId === null)
      .flatMap((p) => {
        const kids = categories.filter((c) => c.parentId === p.id);
        const own = counts.get(p.id) ?? 0;
        return [
          { slug: p.slug, name: p.name, count: kids.reduce((n, k) => n + (counts.get(k.id) ?? 0), own), depth: 0 as const },
          ...kids.map((k) => ({ slug: k.slug, name: k.name, count: counts.get(k.id) ?? 0, depth: 1 as const })),
        ];
      }),
    price: {
      min: Math.floor((price._min.priceCents ?? 0) / 100),
      max: Math.ceil((price._max.priceCents ?? 0) / 100),
    },
    tags,
    brands: brands.flatMap((b) => (b.brand ? [{ brand: b.brand, count: b._count._all }] : [])),
  };
}

/** Category for the breadcrumb, metadata and the not-found check. */
export async function getCategoryBySlug(slug: string) {
  "use cache";
  cacheTag(CacheTags.categories);
  cacheLife("hours");

  return prisma.category.findFirst({
    where: { slug, ...visibleCategoryWhere },
    select: { slug: true, name: true, description: true, seoTitle: true, seoDescription: true },
  });
}

/**
 * Old category slug → current slug (admin slug edits write a CATEGORY SlugRedirect).
 * Only to a category the storefront shows.
 */
export async function getCategorySlugRedirect(slug: string): Promise<string | null> {
  "use cache";
  cacheTag(CacheTags.categories);
  cacheLife("hours");

  const row = await prisma.slugRedirect.findUnique({
    where: { kind_fromSlug: { kind: "CATEGORY", fromSlug: slug } },
    select: { category: { select: { slug: true, isActive: true, parent: { select: { isActive: true } } } } },
  });
  const c = row?.category;
  return c && c.isActive && (c.parent?.isActive ?? true) ? c.slug : null;
}

/** Sidebar "Sale Products": best-reviewed products whose default variant is discounted. */
export async function getSaleProducts(limit = 3) {
  "use cache";
  cacheTag(CacheTags.products);
  cacheLife("hours");

  const rows = await prisma.product.findMany({
    where: { status: "PUBLISHED", variants: { some: { isDefault: true, compareAtCents: { not: null } } } },
    orderBy: [{ reviewCount: "desc" }, { ratingAvg: "desc" }, { id: "asc" }],
    take: limit * 4,
    select: productCardSelect,
  });
  // compareAt > price can't be expressed across columns in a Prisma where; filter here.
  return toCards(rows)
    .filter((p) => (p.compareAtCents ?? 0) > p.priceCents)
    .slice(0, limit);
}
