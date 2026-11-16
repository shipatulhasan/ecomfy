import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CacheTags } from "@/lib/cache-tags";
import type { Prisma } from "@/lib/generated/prisma/client";
import { firstImage, productImages, type ImageData } from "@/lib/catalog/images";
import { mediaUrl } from "@/lib/storage/core";

/**
 * Catalog reads are cached with "use cache" and tagged so admin mutations can
 * invalidate them (updateTag(CacheTags.categories) in the admin action).
 */

/**
 * What the storefront may show: active categories whose parent (if any) is active.
 * Deactivating a parent hides its children too. Products stay reachable by URL.
 */
export const visibleCategoryWhere = {
  isActive: true,
  OR: [{ parentId: null }, { parent: { isActive: true } }],
} satisfies Prisma.CategoryWhereInput;

const categoryCardSelect = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  image: { select: { key: true } },
} satisfies Prisma.CategorySelect;

export type StoreCategory = { id: string; name: string; slug: string; parentId: string | null; imageUrl: string | null };
export type StoreCategoryNode = StoreCategory & { children: StoreCategory[] };

const toStoreCategory = ({ image, ...c }: Prisma.CategoryGetPayload<{ select: typeof categoryCardSelect }>): StoreCategory => ({
  ...c,
  imageUrl: image ? mediaUrl(image.key) : null,
});

/** Active top-level categories in admin order, each with its active children (header menu). */
export async function getCategoryTree(): Promise<StoreCategoryNode[]> {
  "use cache";
  cacheTag(CacheTags.categories);
  cacheLife("hours");

  const rows = await prisma.category.findMany({
    where: visibleCategoryWhere,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: categoryCardSelect,
  });
  const all = rows.map(toStoreCategory);
  return all
    .filter((c) => c.parentId === null)
    .map((p) => ({ ...p, children: all.filter((c) => c.parentId === p.id) }));
}

/** Active top-level categories, in admin order (Search "Browse categories"). */
export async function getCategories(): Promise<StoreCategory[]> {
  "use cache";
  cacheTag(CacheTags.categories);
  cacheLife("hours");

  const rows = await prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: categoryCardSelect,
  });
  return rows.map(toStoreCategory);
}

/** Home → Popular Categories: active categories flagged "Featured on home", in admin order. */
export async function getHomeCategories(): Promise<StoreCategory[]> {
  "use cache";
  cacheTag(CacheTags.categories);
  cacheLife("hours");

  const rows = await prisma.category.findMany({
    where: { ...visibleCategoryWhere, isFeatured: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { ...categoryCardSelect, sortOrder: true, parent: { select: { sortOrder: true } } },
  });
  // Tree order: a featured child sits right after its parent's slot.
  const key = (r: (typeof rows)[number]) => [r.parent?.sortOrder ?? r.sortOrder, r.parent ? 1 : 0, r.sortOrder] as const;
  rows.sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  return rows.map((r) => toStoreCategory({ id: r.id, name: r.name, slug: r.slug, parentId: r.parentId, image: r.image }));
}

// ───────────────────────── product cards ─────────────────────────

/** Everything a ProductCard renders. Plain serializable data (crosses to client leaves). */
export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  image: ImageData | null;
  variantId: string;
  /** Default variant's name ("1 kg"): the mini cart row added from a card. */
  variantName: string;
  /** Default variant's stock. */
  stock: number;
  priceCents: number;
  compareAtCents: number | null;
  inStock: boolean;
  ratingAvg: number;
  reviewCount: number;
  dealEndsAt: string | null; // ISO
};

export const productCardSelect = {
  id: true,
  slug: true,
  name: true,
  ratingAvg: true,
  reviewCount: true,
  dealEndsAt: true,
  images: productImages(1),
  variants: {
    // Default variant first; it is the one a card shows and adds to the cart.
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    take: 1,
    select: { id: true, name: true, priceCents: true, compareAtCents: true, stock: true },
  },
} satisfies Prisma.ProductSelect;

export type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;

function toProductCard(row: ProductCardRow): ProductCardData | null {
  const variant = row.variants[0];
  if (!variant) return null; // a product without variants can't be sold
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    image: firstImage(row.images, row.name),
    variantId: variant.id,
    variantName: variant.name,
    stock: variant.stock,
    priceCents: variant.priceCents,
    compareAtCents: variant.compareAtCents,
    inStock: variant.stock > 0,
    ratingAvg: row.ratingAvg,
    reviewCount: row.reviewCount,
    dealEndsAt: row.dealEndsAt?.toISOString() ?? null,
  };
}

export const toCards = (rows: ProductCardRow[]) =>
  rows.map(toProductCard).filter((p): p is ProductCardData => p !== null);

/** Home → Popular Products: best reviewed first. */
export async function getPopularProducts(limit = 10) {
  "use cache";
  cacheTag(CacheTags.products);
  cacheLife("hours");

  const rows = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ reviewCount: "desc" }, { ratingAvg: "desc" }, { createdAt: "asc" }],
    take: limit,
    select: productCardSelect,
  });
  return toCards(rows);
}

/**
 * Home → Hot Deals: running deals (soonest ending first), then the rest of the
 * catalog, on-sale items first. The first item is the spotlight card.
 */
export async function getHotDeals(limit = 12) {
  "use cache";
  cacheTag(CacheTags.products);
  cacheLife("minutes"); // deals expire; keep the "still running" filter fresh

  const rows = await prisma.product.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ dealEndsAt: null }, { dealEndsAt: { gt: new Date() } }],
    },
    orderBy: [{ dealEndsAt: { sort: "asc", nulls: "last" } }, { reviewCount: "desc" }],
    take: limit * 2,
    select: productCardSelect,
  });
  const cards = toCards(rows);
  const onSale = (p: ProductCardData) => (p.compareAtCents ?? 0) > p.priceCents;
  const deals = cards.filter((p) => p.dealEndsAt);
  const rest = cards.filter((p) => !p.dealEndsAt);
  // Stable sorts: on-sale first, otherwise keep "soonest ending" — so the spotlight
  // is the soonest-ending discounted deal.
  deals.sort((a, b) => Number(onSale(b)) - Number(onSale(a)));
  rest.sort((a, b) => Number(onSale(b)) - Number(onSale(a)));
  return [...deals, ...rest].slice(0, limit);
}

/** Home → Featured Products (admin "Featured" flag). */
export async function getFeaturedProducts(limit = 5) {
  "use cache";
  cacheTag(CacheTags.products);
  cacheLife("hours");

  const rows = await prisma.product.findMany({
    where: { status: "PUBLISHED", isFeatured: true },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: productCardSelect,
  });
  return toCards(rows);
}

/**
 * PDP → Related Products: the most-reviewed products of the same category, topped
 * up from the rest of the catalog when the category has fewer than `limit`.
 */
export async function getRelatedProducts(productId: string, categorySlug: string, limit = 4) {
  "use cache";
  cacheTag(CacheTags.products, CacheTags.productsInCategory(categorySlug));
  cacheLife("hours");

  const order = [{ reviewCount: "desc" }, { ratingAvg: "desc" }, { createdAt: "asc" }] satisfies Prisma.ProductOrderByWithRelationInput[];
  const same = await prisma.product.findMany({
    where: { status: "PUBLISHED", id: { not: productId }, category: { slug: categorySlug } },
    orderBy: order,
    take: limit,
    select: productCardSelect,
  });
  const others =
    same.length < limit
      ? await prisma.product.findMany({
          where: { status: "PUBLISHED", id: { notIn: [productId, ...same.map((p) => p.id)] } },
          orderBy: order,
          take: limit - same.length,
          select: productCardSelect,
        })
      : [];
  return toCards([...same, ...others]);
}
