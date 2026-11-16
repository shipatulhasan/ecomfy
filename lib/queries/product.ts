import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CacheTags } from "@/lib/cache-tags";
import { brandLogo } from "@/lib/config/product";
import type { Asset } from "@/lib/assets";
import type { Prisma } from "@/lib/generated/prisma/client";
import { productHtmlToText, sanitizeProductHtml } from "@/lib/rich-text";
import { productImages, toImage, type ImageData } from "@/lib/catalog/images";

/**
 * One product with everything the Quick View and the PDP render. Plain
 * serializable data (it crosses into the client gallery / purchase leaves).
 */
export type ProductImageData = ImageData;

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

const detailSelect = {
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
  images: productImages(),
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
} satisfies Prisma.ProductSelect;

type DetailRow = Prisma.ProductGetPayload<{ select: typeof detailSelect }>;

function toDetail(row: DetailRow | null): ProductDetail | null {
  if (!row || row.status !== "PUBLISHED" || row.variants.length === 0) return null;
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
    images: row.images.map((i, n) => toImage(i, n === 0 ? row.name : `${row.name}, view ${n + 1}`)),
    variants: row.variants,
  };
}

/**
 * Quick View read. Cached across requests and tagged with the product's own tag
 * plus `products`, so admin product mutations invalidate it with updateTag().
 * Returns null for unknown or non-active products; callers call notFound().
 */
export async function getProductQuickView(slug: string): Promise<ProductDetail | null> {
  "use cache";
  cacheTag(CacheTags.product(slug), CacheTags.products);
  cacheLife("hours");

  return toDetail(await prisma.product.findUnique({ where: { slug }, select: detailSelect }));
}

export type ProductAttributeData = { name: string; value: string };

/** The PDP adds the three tab panels' data to the Quick View fields. */
export type ProductPageData = ProductDetail & {
  /** Sanitized HTML (lib/rich-text.ts), safe for dangerouslySetInnerHTML. */
  descriptionHtml: string;
  /** Plain text of the description (meta description / JSON-LD fallback). */
  descriptionText: string;
  productType: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  /** Additional Information rows stored on the product, in sortOrder. */
  attributes: ProductAttributeData[];
  /** Units across all variants ("Available (5,413)"). */
  totalStock: number;
  seoTitle: string | null;
  seoDescription: string | null;
};

/** PDP read (/product/[slug]). Same tags as the Quick View read. */
export async function getProductPage(slug: string): Promise<ProductPageData | null> {
  "use cache";
  cacheTag(CacheTags.product(slug), CacheTags.products);
  cacheLife("hours");

  const row = await prisma.product.findUnique({
    where: { slug },
    select: {
      ...detailSelect,
      description: true,
      productType: true,
      videoUrl: true,
      videoPosterUrl: true,
      seoTitle: true,
      seoDescription: true,
      attributes: { orderBy: { sortOrder: "asc" }, select: { name: true, value: true } },
    },
  });
  const base = toDetail(row);
  if (!row || !base) return null;

  return {
    ...base,
    descriptionHtml: sanitizeProductHtml(row.description),
    descriptionText: productHtmlToText(row.description),
    productType: row.productType,
    videoUrl: row.videoUrl,
    videoPosterUrl: row.videoPosterUrl,
    attributes: row.attributes,
    totalStock: row.variants.reduce((n, v) => n + v.stock, 0),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
  };
}

/**
 * Old slug → current slug of a live product (admin slug edits write a
 * SlugRedirect). Tagged `products`, so a rename or un-publish refreshes it.
 */
export async function getSlugRedirect(slug: string): Promise<string | null> {
  "use cache";
  cacheTag(CacheTags.products, CacheTags.product(slug));
  cacheLife("hours");

  const row = await prisma.slugRedirect.findUnique({
    where: { fromSlug: slug },
    select: { product: { select: { slug: true, status: true } } },
  });
  return row && row.product.status === "PUBLISHED" ? row.product.slug : null;
}
