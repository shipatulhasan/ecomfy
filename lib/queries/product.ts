import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CacheTags } from "@/lib/cache-tags";
import { brandLogo } from "@/lib/config/product";
import type { Asset } from "@/lib/assets";

/**
 * One product with everything the Quick View and the PDP render. Plain
 * serializable data (it crosses into the client gallery / purchase leaves).
 */
export type ProductImageData = { url: string; alt: string; width: number; height: number };

export type ProductVariantData = {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  compareAtCents: number | null;
  stock: number;
  isDefault: boolean;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  brand: string | null;
  brandLogo: Asset | null;
  tags: string[];
  category: { name: string; slug: string };
  ratingAvg: number;
  reviewCount: number;
  images: ProductImageData[];
  /** Default variant first, then creation order. Never empty. */
  variants: ProductVariantData[];
};

/**
 * Quick View / PDP read. Cached across requests and tagged with the product's own
 * tag plus `products`, so admin product mutations invalidate it with updateTag().
 * Returns null for unknown or non-active products; callers call notFound().
 */
export async function getProductQuickView(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheTag(CacheTags.product(slug), CacheTags.products);
  cacheLife("hours");

  const row = await prisma.product.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      shortDescription: true,
      brand: true,
      tags: true,
      ratingAvg: true,
      reviewCount: true,
      category: { select: { name: true, slug: true } },
      images: {
        orderBy: { position: "asc" },
        select: { url: true, alt: true, width: true, height: true },
      },
      variants: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          sku: true,
          priceCents: true,
          compareAtCents: true,
          stock: true,
          isDefault: true,
        },
      },
    },
  });
  if (!row || row.status !== "ACTIVE" || row.variants.length === 0) return null;

  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortDescription: row.shortDescription,
    brand: row.brand,
    brandLogo: brandLogo(row.brand),
    tags: row.tags,
    category: row.category,
    ratingAvg: row.ratingAvg,
    reviewCount: row.reviewCount,
    images: row.images,
    variants: row.variants,
  };
}
