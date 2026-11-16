import "server-only";
import { requirePermission } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import type { MediaItem } from "@/lib/admin/media";
import { STATUS_PARAMS, type ProductListParams } from "@/lib/admin/products/params";
import { stockLevel, toTaka, type StockLevel } from "@/lib/admin/products/rules";
import { mediaUrl } from "@/lib/storage";
import type { ProductFormValues } from "@/lib/validations/admin-product";

/**
 * Admin product reads. Admin pages are dynamic and per-request: no "use cache"
 * here (every call checks the permission first, then reads fresh rows).
 */

// ───────────────────────────── Product List ─────────────────────────────

export type AdminProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt: string;
  category: { name: string; slug: string };
  image: { url: string; blurDataURL: string | null } | null;
  priceCents: number;
  compareAtCents: number | null;
  /** Units across variants; null when inventory isn't tracked ("Unlimited"). */
  stock: number | null;
  level: StockLevel;
  variantCount: number;
};

export type AdminProductPage = { rows: AdminProductRow[]; total: number; page: number; pages: number };

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const ORDER: Record<ProductListParams["sort"]["key"], Prisma.Sql> = {
  product: Prisma.sql`lower(b."name")`,
  price: Prisma.sql`b."priceCents"`,
  sku: Prisma.sql`b."sku"`,
  qty: Prisma.sql`b."qty"`,
  category: Prisma.sql`lower(b."cat")`,
  date: Prisma.sql`b."createdAt"`,
  status: Prisma.sql`b."status"`,
};

/** `all`: CSV export (every matching row, up to EXPORT_LIMIT, ignoring the page). */
export const EXPORT_LIMIT = 5000;

export async function listAdminProducts(p: ProductListParams, opts: { all?: boolean } = {}): Promise<AdminProductPage> {
  await requirePermission("products:read");

  const where: Prisma.Sql[] = [Prisma.sql`p."deletedAt" IS NULL`];
  if (p.q) where.push(Prisma.sql`(p."name" ILIKE ${like(p.q)} OR p."sku" ILIKE ${like(p.q)})`);
  if (p.category) where.push(Prisma.sql`c."slug" = ${p.category}`);
  // Archived products are listed only under their own filter.
  where.push(p.status ? Prisma.sql`p."status" = ${STATUS_PARAMS[p.status]}::"ProductStatus"` : Prisma.sql`p."status" <> 'ARCHIVED'`);
  if (p.brand) where.push(Prisma.sql`p."brand" = ${p.brand}`);

  const stock =
    p.stock === "out"
      ? Prisma.sql`b."qty" <= 0`
      : p.stock === "low"
        ? Prisma.sql`b."trackInventory" AND b."qty" > 0 AND b."qty" <= b."lowStockThreshold"`
        : p.stock === "in"
          ? Prisma.sql`b."qty" > 0 AND NOT (b."trackInventory" AND b."qty" <= b."lowStockThreshold")`
          : Prisma.sql`TRUE`;

  const dir = p.sort.dir === "desc" ? Prisma.sql`DESC` : Prisma.sql`ASC`;
  const limit = opts.all ? EXPORT_LIMIT : p.perPage;
  const offset = opts.all ? 0 : (p.page - 1) * p.perPage;

  const ids = await prisma.$queryRaw<{ id: string; total: bigint }[]>`
    WITH b AS (
      SELECT p."id", p."name", p."sku", p."priceCents", p."createdAt", p."status", p."trackInventory", p."lowStockThreshold",
        c."name" AS "cat",
        COALESCE((SELECT sum(v."stock") FROM "Variant" v WHERE v."productId" = p."id"), 0) AS "qty"
      FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId"
      WHERE ${Prisma.join(where, " AND ")}
    )
    SELECT b."id", count(*) OVER () AS "total" FROM b
    WHERE ${stock}
    ORDER BY ${ORDER[p.sort.key]} ${dir}, b."id"
    LIMIT ${limit} OFFSET ${offset}`;

  const total = Number(ids[0]?.total ?? 0);
  if (ids.length === 0) {
    // Past the last page: report the real total so the page can clamp.
    const count = offset > 0 ? await countOnly(where, stock) : 0;
    return { rows: [], total: count, page: p.page, pages: Math.max(1, Math.ceil(count / p.perPage)) };
  }

  const rows = await prisma.product.findMany({
    where: { id: { in: ids.map((r) => r.id) } },
    select: {
      id: true,
      name: true,
      slug: true,
      sku: true,
      status: true,
      createdAt: true,
      trackInventory: true,
      lowStockThreshold: true,
      category: { select: { name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { media: { select: { key: true, blurDataURL: true } } } },
      variants: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
        select: { priceCents: true, compareAtCents: true, stock: true },
      },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  return {
    total,
    page: p.page,
    pages: Math.max(1, Math.ceil(total / p.perPage)),
    rows: ids.flatMap(({ id }) => {
      const r = byId.get(id);
      if (!r) return [];
      const main = r.variants[0];
      const qty = r.variants.reduce((n, v) => n + v.stock, 0);
      const img = r.images[0]?.media;
      return [
        {
          id: r.id,
          name: r.name,
          slug: r.slug,
          sku: r.sku,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
          category: r.category,
          image: img ? { url: mediaUrl(img.key), blurDataURL: img.blurDataURL } : null,
          priceCents: main?.priceCents ?? 0,
          compareAtCents: main?.compareAtCents ?? null,
          stock: r.trackInventory ? qty : null,
          level: stockLevel({ stock: qty, trackInventory: r.trackInventory, lowStockThreshold: r.lowStockThreshold }),
          variantCount: r.variants.length,
        },
      ];
    }),
  };
}

async function countOnly(where: Prisma.Sql[], stock: Prisma.Sql): Promise<number> {
  const [row] = await prisma.$queryRaw<{ n: bigint }[]>`
    WITH b AS (
      SELECT p."trackInventory", p."lowStockThreshold",
        COALESCE((SELECT sum(v."stock") FROM "Variant" v WHERE v."productId" = p."id"), 0) AS "qty"
      FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId"
      WHERE ${Prisma.join(where, " AND ")}
    )
    SELECT count(*) AS n FROM b WHERE ${stock}`;
  return Number(row?.n ?? 0);
}

/** Filter options + the category list for bulk "Change category" and the form. */
export async function getProductFilterOptions() {
  await requirePermission("products:read");
  const [categories, brands, tags] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } }),
    prisma.product.findMany({
      where: { deletedAt: null, brand: { not: null } },
      distinct: ["brand"],
      orderBy: { brand: "asc" },
      select: { brand: true },
    }),
    prisma.$queryRaw<{ tag: string }[]>`
      SELECT DISTINCT unnest("tags") AS tag FROM "Product" WHERE "deletedAt" IS NULL ORDER BY tag LIMIT 500`,
  ]);
  return {
    categories,
    brands: brands.map((b) => b.brand!).filter(Boolean),
    tags: tags.map((t) => t.tag),
  };
}

export type ProductFilterOptions = Awaited<ReturnType<typeof getProductFilterOptions>>;

// ───────────────────────────── Add / Edit Product ─────────────────────────────

export type AdminProductForm = {
  values: ProductFormValues;
  /** Media for the images in `values.images`, keyed by id. */
  media: Record<string, MediaItem>;
  categorySlug: string;
  updatedAt: string;
};

export async function getAdminProduct(id: string): Promise<AdminProductForm | null> {
  await requirePermission("products:read");
  const p = await prisma.product.findUnique({
    where: { id },
    include: {
      category: { select: { slug: true } },
      variants: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
      attributes: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" }, include: { media: true } },
    },
  });
  if (!p || p.deletedAt) return null;

  // Variants without size/colour (older rows) but more than one option: their names are the sizes.
  const legacy = p.variants.length > 1 && p.variants.every((v) => !v.size && !v.color);
  if (legacy) for (const v of p.variants) v.size = v.name;
  const sizes = [...new Set(p.variants.map((v) => v.size).filter((s): s is string => Boolean(s)))];
  const colors = [...new Set(p.variants.map((v) => v.color).filter((s): s is string => Boolean(s)))];
  const options = [
    ...(sizes.length ? [{ name: "Size" as const, values: sizes }] : []),
    ...(colors.length ? [{ name: "Color" as const, values: colors }] : []),
  ];
  const keyOf = (v: { size: string | null; color: string | null }) =>
    [v.color && `Color:${v.color}`, v.size && `Size:${v.size}`].filter(Boolean).join("|");
  const keyById = new Map(p.variants.map((v) => [v.id, keyOf(v)]));

  const main = p.variants[0];
  const stockStatus = p.trackInventory ? p.stockStatus : (main?.stock ?? 0) > 0 ? "IN_STOCK" : "OUT_OF_STOCK";

  return {
    categorySlug: p.category.slug,
    updatedAt: p.updatedAt.toISOString(),
    media: Object.fromEntries(p.images.map((i) => [i.mediaId, mediaItem(i.media)])),
    values: {
      id: p.id,
      status: p.status,
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      shortDescription: p.shortDescription ?? "",
      description: p.description,
      categoryId: p.categoryId,
      tags: p.tags,
      brand: p.brand ?? "",
      productType: p.productType ?? "",
      taxIncluded: p.taxIncluded,
      saleStartsAt: p.saleStartsAt?.toISOString() ?? null,
      saleEndsAt: p.dealEndsAt?.toISOString() ?? null,
      trackInventory: p.trackInventory,
      stockStatus,
      lowStockThreshold: p.lowStockThreshold,
      isFeatured: p.isFeatured,
      seoTitle: p.seoTitle ?? "",
      seoDescription: p.seoDescription ?? "",
      options,
      variants: p.variants.map((v) => ({
        id: v.id,
        key: keyOf(v),
        name: v.name,
        sku: v.sku,
        price: toTaka(v.regularPriceCents || v.priceCents),
        discount: v.salePriceCents !== null ? toTaka((v.regularPriceCents || v.priceCents) - v.salePriceCents) : null,
        stock: p.trackInventory ? v.stock : 0,
        size: v.size,
        color: v.color,
        weightGrams: v.weightGrams,
      })),
      attributes: p.attributes.map((a) => ({ name: a.name, value: a.value })),
      images: p.images.map((i) => ({ mediaId: i.mediaId, alt: i.media.alt, variantKey: i.variantId ? (keyById.get(i.variantId) ?? null) : null })),
    },
  };
}

/** Add Product header "Search product for add": jump to an existing product. */
export async function searchProductsForAdd(q: string) {
  await requirePermission("products:read");
  const term = q.trim().slice(0, 100);
  if (!term) return [];
  const rows = await prisma.product.findMany({
    where: { deletedAt: null, OR: [{ name: { contains: term, mode: "insensitive" } }, { sku: { contains: term, mode: "insensitive" } }] },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: { id: true, name: true, sku: true, status: true, images: { orderBy: { sortOrder: "asc" }, take: 1, select: { media: { select: { key: true } } } } },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, sku: r.sku, status: r.status, imageUrl: r.images[0] ? mediaUrl(r.images[0].media.key) : null }));
}

// ───────────────────────────── Product Media ─────────────────────────────

export type MediaListParams = { q: string; used: "used" | "unused" | null; page: number };
export const MEDIA_PER_PAGE = 30;

export function parseMediaParams(sp: Record<string, string | string[] | undefined>): MediaListParams {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const used = one(sp.used);
  return {
    q: one(sp.q).trim().slice(0, 100),
    used: used === "used" || used === "unused" ? used : null,
    page: Math.max(1, Number.parseInt(one(sp.page), 10) || 1),
  };
}

export async function listMedia(p: MediaListParams): Promise<{ items: MediaItem[]; total: number; pages: number }> {
  await requirePermission("products:read");
  const where: Prisma.MediaWhereInput = {
    // Abandoned product-form uploads aren't library items (the cleanup job removes them).
    NOT: { key: { startsWith: "tmp/" }, productImages: { none: {} } },
    ...(p.q && { OR: [{ originalName: { contains: p.q, mode: "insensitive" } }, { alt: { contains: p.q, mode: "insensitive" } }] }),
    ...(p.used === "used" && { productImages: { some: {} } }),
    ...(p.used === "unused" && { productImages: { none: {} } }),
  };
  const [total, rows] = await prisma.$transaction([
    prisma.media.count({ where }),
    prisma.media.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (p.page - 1) * MEDIA_PER_PAGE,
      take: MEDIA_PER_PAGE,
      include: { productImages: { take: 3, select: { product: { select: { id: true, name: true } } } } },
    }),
  ]);
  return {
    total,
    pages: Math.max(1, Math.ceil(total / MEDIA_PER_PAGE)),
    items: rows.map((m) => ({ ...mediaItem(m), usedBy: m.productImages.map((i) => i.product) })),
  };
}

function mediaItem(m: {
  id: string;
  key: string;
  originalName: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  alt: string;
  blurDataURL: string | null;
  createdAt: Date;
}): MediaItem {
  return {
    id: m.id,
    url: mediaUrl(m.key),
    originalName: m.originalName,
    mime: m.mime,
    size: m.size,
    width: m.width,
    height: m.height,
    alt: m.alt,
    blurDataURL: m.blurDataURL,
    createdAt: m.createdAt.toISOString(),
  };
}


// ───────────────────────────── form helpers ─────────────────────────────

/** Next numeric product SKU ("021284") for a new product, like the seeded ones. */
export async function nextProductSku(): Promise<string> {
  await requirePermission("products:read");
  const [row] = await prisma.$queryRaw<{ max: string | null }[]>`
    SELECT max("sku") AS max FROM "Product" WHERE "sku" ~ '^[0-9]{6}$'`;
  const n = row?.max ? Number(row.max) + 1 : 21231;
  return String(n).padStart(6, "0");
}

/** Product Media upload limit (Settings.maxUploadMb). */
export async function getMaxUploadMb(): Promise<number> {
  const s = await prisma.settings.findUnique({ where: { id: "default" }, select: { maxUploadMb: true } });
  return s?.maxUploadMb ?? 5;
}
