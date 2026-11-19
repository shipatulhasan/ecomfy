"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { derivePrice, slugify, toPoisha, UNLIMITED_STOCK } from "@/lib/admin/products/rules";
import { logAudit } from "@/lib/audit";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { sanitizeProductHtml } from "@/lib/rich-text";
import { publicUrl, storage, storageKeys } from "@/lib/storage";
import {
  bulkCategorySchema,
  bulkStatusSchema,
  checkSlugSchema,
  inlineCategorySchema,
  productFormSchema,
  productIdSchema,
  productIdsSchema,
  type ProductFormData,
} from "@/lib/validations/admin-product";
import { can } from "@/lib/auth/permissions";
import { ActionError, FORBIDDEN, type ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Admin product mutations (Product List, Add / Edit Product). Every action
 * re-checks `products:create|update|delete` (runAdminAction), runs in one transaction with an
 * audit entry, and expires the storefront's catalog tags with updateTag()
 * (read-your-own-writes) so Home, Shop, Quick View and the PDP update at once.
 */

type Tx = Prisma.TransactionClient;

function omit<T extends object, K extends keyof T>(o: T, keys: K[]): Omit<T, K> {
  const out = { ...o };
  for (const k of keys) delete out[k];
  return out;
}

const FIX_FIELDS = "Please fix the highlighted fields.";

// ───────────────────────────── cache ─────────────────────────────

function invalidate(slugs: (string | null | undefined)[], categorySlugs: (string | null | undefined)[]) {
  updateTag(CacheTags.products);
  updateTag(CacheTags.categories); // per-category product counts
  for (const s of new Set(slugs)) if (s) updateTag(CacheTags.product(s));
  for (const c of new Set(categorySlugs)) if (c) updateTag(CacheTags.productsInCategory(c));
}

// ───────────────────────────── audit snapshot ─────────────────────────────

const snapshotSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  status: true,
  deletedAt: true,
  brand: true,
  tags: true,
  isFeatured: true,
  taxIncluded: true,
  trackInventory: true,
  stockStatus: true,
  lowStockThreshold: true,
  saleStartsAt: true,
  dealEndsAt: true,
  seoTitle: true,
  seoDescription: true,
  priceCents: true,
  categoryId: true,
  category: { select: { slug: true } },
  variants: {
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: { id: true, sku: true, name: true, regularPriceCents: true, salePriceCents: true, priceCents: true, stock: true },
  },
  images: { orderBy: { sortOrder: "asc" }, select: { mediaId: true, variantId: true } },
  attributes: { orderBy: { sortOrder: "asc" }, select: { name: true, value: true } },
} satisfies Prisma.ProductSelect;

type Snapshot = Prisma.ProductGetPayload<{ select: typeof snapshotSelect }>;

/** JSON for AuditLog.before/after (dates → ISO, nested category dropped). */
function auditJson(s: Snapshot | null): Prisma.InputJsonValue | null {
  if (!s) return null;
  return JSON.parse(JSON.stringify({ ...s, category: undefined })) as Prisma.InputJsonValue;
}

// ───────────────────────────── save ─────────────────────────────

/**
 * Add / Edit Product → Save to draft / Publish Product. Re-validates the same
 * zod schema as the form, sanitizes the description, checks slug/SKU
 * uniqueness, moves tmp uploads into products/{id}/, then writes product,
 * variants, attributes and image order in one transaction. A slug change leaves
 * a SlugRedirect so the old URL 308s to the new one.
 */
export async function saveProduct(input: unknown): Promise<ActionResult<{ id: string; slug: string; status: string }>> {
  return runAdminAction(["products:create", "products:update"], productFormSchema, input, async (data, actor) => {
    if (!can(actor, data.id ? "products:update" : "products:create")) throw new ActionError(FORBIDDEN);
    const before = data.id ? await prisma.product.findUnique({ where: { id: data.id }, select: snapshotSelect }) : null;
    if (data.id && (!before || before.deletedAt)) throw new ActionError("This product no longer exists.");

    await assertUnique(data);
    const category = await prisma.category.findUnique({ where: { id: data.categoryId }, select: { slug: true } });
    if (!category) throw new ActionError(FIX_FIELDS, { categoryId: ["That category no longer exists"] });

    const mediaIds = data.images.map((i) => i.mediaId);
    const media = await prisma.media.findMany({ where: { id: { in: mediaIds } }, select: { id: true, key: true } });
    if (media.length !== new Set(mediaIds).size) throw new ActionError("An image was deleted meanwhile. Remove it and save again.");

    const productId = data.id ?? randomUUID();

    // Copy tmp uploads into the product's folder before the transaction (S3 isn't transactional).
    const moves = media
      .filter((m) => storageKeys.isTmp(m.key))
      .map((m) => ({ id: m.id, from: m.key, to: storageKeys.product(productId, randomUUID(), m.key.split(".").pop()!) }));
    await Promise.all(moves.map((m) => storage.copy(m.from, m.to)));

    let after: Snapshot;
    try {
      after = await prisma.$transaction(async (tx) => {
        for (const m of moves) await tx.media.update({ where: { id: m.id }, data: { key: m.to, url: publicUrl(m.to) } });
        await writeProduct(tx, productId, data, before);
        const row = await tx.product.findUniqueOrThrow({ where: { id: productId }, select: snapshotSelect });
        await logAudit(
          {
            actorId: actor.id,
            action: before ? "product.update" : "product.create",
            entity: "Product",
            entityId: productId,
            before: auditJson(before),
            after: auditJson(row),
          },
          tx,
        );
        return row;
      });
    } catch (err) {
      await storage.delete(moves.map((m) => m.to)).catch(() => {});
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ActionError(FIX_FIELDS, { slug: ["Slug or SKU was just taken. Change it and save again."] });
      }
      throw err;
    }
    await storage.delete(moves.map((m) => m.from)).catch((e) => console.error("[products] tmp cleanup", e));

    invalidate([before?.slug, after.slug], [before?.category.slug, category.slug]);
    return { id: after.id, slug: after.slug, status: after.status };
  });
}

async function assertUnique(data: ProductFormData) {
  const errors: Record<string, string[]> = {};
  const notSelf = data.id ? { not: data.id } : undefined;
  const [slugTaken, skuTaken, variantSkus] = await Promise.all([
    prisma.product.findFirst({ where: { slug: data.slug, id: notSelf }, select: { id: true } }),
    prisma.product.findFirst({ where: { sku: { equals: data.sku, mode: "insensitive" }, id: notSelf }, select: { id: true } }),
    prisma.variant.findMany({
      where: { sku: { in: data.variants.map((v) => v.sku) }, ...(notSelf && { productId: notSelf }) },
      select: { sku: true },
    }),
  ]);
  if (slugTaken) errors.slug = ["Another product uses this slug"];
  if (skuTaken) errors.sku = ["Another product uses this SKU"];
  const taken = new Set(variantSkus.map((v) => v.sku));
  data.variants.forEach((v, i) => {
    if (taken.has(v.sku)) errors[`variants.${i}.sku`] = ["Another product uses this SKU"];
  });
  if (Object.keys(errors).length > 0) throw new ActionError(FIX_FIELDS, errors);
}

async function writeProduct(tx: Tx, productId: string, data: ProductFormData, before: Snapshot | null) {
  const window = {
    saleStartsAt: data.saleStartsAt ? new Date(data.saleStartsAt) : null,
    dealEndsAt: data.saleEndsAt ? new Date(data.saleEndsAt) : null,
  };
  const rows = data.variants.map((v) => {
    const regularPriceCents = toPoisha(v.price);
    const salePriceCents = v.discount ? regularPriceCents - toPoisha(v.discount) : null;
    const stock = data.trackInventory ? v.stock : data.stockStatus === "IN_STOCK" ? UNLIMITED_STOCK : 0;
    return { ...v, regularPriceCents, salePriceCents, stock, ...derivePrice({ regularPriceCents, salePriceCents }, window) };
  });

  const fields = {
    name: data.name,
    slug: data.slug,
    sku: data.sku,
    shortDescription: data.shortDescription || null,
    description: sanitizeProductHtml(data.description),
    brand: data.brand || null,
    productType: data.productType || null,
    tags: [...new Set(data.tags)],
    isFeatured: data.isFeatured,
    taxIncluded: data.taxIncluded,
    trackInventory: data.trackInventory,
    stockStatus: data.stockStatus,
    lowStockThreshold: data.lowStockThreshold,
    saleStartsAt: window.saleStartsAt,
    dealEndsAt: window.dealEndsAt,
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
    status: data.status,
    priceCents: rows[0]!.priceCents,
    categoryId: data.categoryId,
  };

  if (before) {
    await tx.product.update({ where: { id: productId }, data: fields });
  } else {
    await tx.product.create({ data: { id: productId, ...fields } });
  }

  // Slug change: the old URL keeps working (308). The new slug can't stay a redirect.
  await tx.slugRedirect.deleteMany({ where: { kind: "PRODUCT", fromSlug: data.slug } });
  if (before && before.slug !== data.slug) {
    await tx.slugRedirect.upsert({
      where: { kind_fromSlug: { kind: "PRODUCT", fromSlug: before.slug } },
      create: { kind: "PRODUCT", fromSlug: before.slug, productId },
      update: { productId },
    });
  }

  // Variants: update kept rows, create new ones, delete removed ones
  // (order items keep their name/price snapshot; OrderItem.variantId → null).
  const keepIds = new Set(before?.variants.map((v) => v.id));
  const kept = rows.filter((r) => r.id && keepIds.has(r.id)).map((r) => r.id!);
  await tx.variant.deleteMany({ where: { productId, id: { notIn: kept } } });
  // Free SKUs first so swapping SKUs between rows can't hit the unique index.
  for (const id of kept) await tx.variant.update({ where: { id }, data: { sku: `__tmp_${id}` } });

  const idByKey = new Map<string, string>();
  for (const [i, r] of rows.entries()) {
    const v = {
      sku: r.sku,
      name: r.name,
      size: r.size || null,
      color: r.color || null,
      weightGrams: r.weightGrams,
      regularPriceCents: r.regularPriceCents,
      salePriceCents: r.salePriceCents,
      priceCents: r.priceCents,
      compareAtCents: r.compareAtCents,
      stock: r.stock,
      isDefault: i === 0,
    };
    const saved =
      r.id && keepIds.has(r.id)
        ? await tx.variant.update({ where: { id: r.id }, data: v, select: { id: true } })
        : await tx.variant.create({ data: { ...v, productId }, select: { id: true } });
    idByKey.set(r.key, saved.id);
  }

  await tx.productAttribute.deleteMany({ where: { productId } });
  if (data.attributes.length > 0) {
    await tx.productAttribute.createMany({
      data: data.attributes.map((a, sortOrder) => ({ productId, name: a.name, value: a.value, sortOrder })),
    });
  }

  // Image order: index 0 is the main image (card, PDP first slide).
  await tx.productImage.deleteMany({ where: { productId } });
  if (data.images.length > 0) {
    await tx.productImage.createMany({
      data: data.images.map((img, sortOrder) => ({
        productId,
        mediaId: img.mediaId,
        sortOrder,
        variantId: img.variantKey !== null ? (idByKey.get(img.variantKey) ?? null) : null,
      })),
    });
    for (const img of data.images) {
      await tx.media.update({ where: { id: img.mediaId }, data: { alt: img.alt } });
    }
  }
}

// ───────────────────────────── slug check ─────────────────────────────

/** Slug field blur: is it free? (Saving re-checks.) */
export async function checkSlug(input: unknown): Promise<ActionResult<{ available: boolean; suggestion: string }>> {
  return runAdminAction(["products:create", "products:update"], checkSlugSchema, input, async ({ slug, excludeId }) => {
    const taken = await prisma.product.findFirst({ where: { slug, id: excludeId ? { not: excludeId } : undefined }, select: { id: true } });
    return { available: !taken, suggestion: taken ? await freeSlug(slug) : slug };
  });
}

async function freeSlug(base: string, db: Tx | typeof prisma = prisma): Promise<string> {
  const rows = await db.product.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
  const used = new Set(rows.map((r) => r.slug));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

async function freeSku(base: string, db: Tx): Promise<string> {
  const [p, v] = await Promise.all([
    db.product.findMany({ where: { sku: { startsWith: base } }, select: { sku: true } }),
    db.variant.findMany({ where: { sku: { startsWith: base } }, select: { sku: true } }),
  ]);
  const used = new Set([...p.map((r) => r.sku), ...v.map((r) => r.sku)]);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

// ───────────────────────────── duplicate ─────────────────────────────

/**
 * Product List → Duplicate. Copies everything as a DRAFT with "-copy" slug/SKU.
 * Images point at the same Media rows (no file copies).
 */
export async function duplicateProduct(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction("products:create", productIdSchema, input, async ({ id }, actor) => {
    const src = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }] },
        images: { orderBy: { sortOrder: "asc" } },
        attributes: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!src || src.deletedAt) throw new ActionError("This product no longer exists.");

    const copy = await prisma.$transaction(async (tx) => {
      const slug = await freeSlug(`${src.slug}-copy`, tx);
      const sku = await freeSku(`${src.sku}-copy`, tx);
      const { variants, images, attributes } = src;
      const fields = omit(src, ["id", "createdAt", "updatedAt", "variants", "images", "attributes", "ratingAvg", "reviewCount", "deletedAt"]);
      const row = await tx.product.create({
        data: { ...fields, name: `${src.name} (copy)`, slug, sku, status: "DRAFT", isFeatured: false },
        select: { id: true },
      });
      const variantMap = new Map<string, string>();
      for (const v of variants) {
        const vid = v.id;
        const vf = omit(v, ["id", "productId", "createdAt", "updatedAt", "reserved"]);
        const created = await tx.variant.create({ data: { ...vf, productId: row.id, sku: await freeSku(`${v.sku}-copy`, tx) }, select: { id: true } });
        variantMap.set(vid, created.id);
      }
      if (images.length) {
        await tx.productImage.createMany({
          data: images.map((i) => ({ productId: row.id, mediaId: i.mediaId, sortOrder: i.sortOrder, variantId: i.variantId ? (variantMap.get(i.variantId) ?? null) : null })),
        });
      }
      if (attributes.length) {
        await tx.productAttribute.createMany({ data: attributes.map((a) => ({ productId: row.id, name: a.name, value: a.value, sortOrder: a.sortOrder })) });
      }
      await logAudit({ actorId: actor.id, action: "product.duplicate", entity: "Product", entityId: row.id, before: { sourceId: id }, after: { slug, sku } }, tx);
      return row;
    });
    invalidate([], []); // drafts aren't on the storefront; admin widgets read `products`
    return copy;
  });
}

// ───────────────────────────── bulk ─────────────────────────────

async function liveProducts(ids: string[]) {
  return prisma.product.findMany({
    where: { id: { in: ids }, deletedAt: null },
    select: { id: true, slug: true, status: true, categoryId: true, category: { select: { slug: true } } },
  });
}

/** Product List bulk / row: Publish, Set to draft, Archive. */
export async function bulkSetStatus(input: unknown): Promise<ActionResult<{ updated: number }>> {
  return runAdminAction("products:update", bulkStatusSchema, input, async ({ ids, status }, actor) => {
    const rows = await liveProducts(ids);
    if (status === "PUBLISHED") {
      const empty = await prisma.product.findMany({ where: { id: { in: rows.map((r) => r.id) }, variants: { none: {} } }, select: { slug: true } });
      if (empty.length) throw new ActionError(`Add a variant before publishing: ${empty.map((e) => e.slug).join(", ")}`);
    }
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.product.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { status } });
      await logAudit(
        {
          actorId: actor.id,
          action: "product.bulk_status",
          entity: "Product",
          before: rows.map((r) => ({ id: r.id, status: r.status })),
          after: { ids: rows.map((r) => r.id), status },
        },
        tx,
      );
      return res.count;
    });
    invalidate(rows.map((r) => r.slug), rows.map((r) => r.category.slug));
    return { updated };
  });
}

/** Product List bulk: Change category. */
export async function bulkSetCategory(input: unknown): Promise<ActionResult<{ updated: number }>> {
  return runAdminAction("products:update", bulkCategorySchema, input, async ({ ids, categoryId }, actor) => {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { slug: true } });
    if (!category) throw new ActionError("That category no longer exists.");
    const rows = await liveProducts(ids);
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.product.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { categoryId } });
      await logAudit(
        {
          actorId: actor.id,
          action: "product.bulk_category",
          entity: "Product",
          before: rows.map((r) => ({ id: r.id, categoryId: r.categoryId })),
          after: { ids: rows.map((r) => r.id), categoryId },
        },
        tx,
      );
      return res.count;
    });
    invalidate(rows.map((r) => r.slug), [...rows.map((r) => r.category.slug), category.slug]);
    return { updated };
  });
}

/**
 * Product List → Delete (row or bulk). Products that appear on an order are
 * soft-deleted (deletedAt + ARCHIVED: gone from the store and the list, still
 * on past orders). The rest are deleted for good, and their images too when no
 * other product uses them.
 */
export async function deleteProducts(input: unknown): Promise<ActionResult<{ archived: number; deleted: number }>> {
  return runAdminAction("products:delete", productIdsSchema, input, async ({ ids }, actor) => {
    const rows = await liveProducts(ids);
    const ordered = await prisma.orderItem.findMany({
      where: { variant: { productId: { in: rows.map((r) => r.id) } } },
      distinct: ["variantId"],
      select: { variant: { select: { productId: true } } },
    });
    const keep = new Set(ordered.map((o) => o.variant!.productId));
    const soft = rows.filter((r) => keep.has(r.id));
    const hard = rows.filter((r) => !keep.has(r.id));

    const orphanKeys = await prisma.$transaction(async (tx) => {
      if (soft.length) {
        await tx.product.updateMany({ where: { id: { in: soft.map((r) => r.id) } }, data: { deletedAt: new Date(), status: "ARCHIVED" } });
      }
      let keys: string[] = [];
      if (hard.length) {
        const imgs = await tx.productImage.findMany({ where: { productId: { in: hard.map((r) => r.id) } }, select: { mediaId: true } });
        await tx.product.deleteMany({ where: { id: { in: hard.map((r) => r.id) } } });
        const orphans = await tx.media.findMany({
          where: { id: { in: imgs.map((i) => i.mediaId) }, productImages: { none: {} }, categoryImages: { none: {} } },
          select: { id: true, key: true },
        });
        await tx.media.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
        keys = orphans.map((o) => o.key).filter((k) => !storageKeys.isLegacy(k));
      }
      await logAudit(
        {
          actorId: actor.id,
          action: "product.delete",
          entity: "Product",
          before: rows.map((r) => ({ id: r.id, slug: r.slug, status: r.status })),
          after: { softDeleted: soft.map((r) => r.id), hardDeleted: hard.map((r) => r.id) },
        },
        tx,
      );
      return keys;
    });
    await storage.delete(orphanKeys).catch((e) => console.error("[products] media cleanup", e));
    invalidate(rows.map((r) => r.slug), rows.map((r) => r.category.slug));
    return { archived: soft.length, deleted: hard.length };
  });
}

// ───────────────────────────── categories ─────────────────────────────

/** Add Product → "+ Add category" inline (categories:create). */
export async function createCategoryInline(input: unknown): Promise<ActionResult<{ id: string; name: string }>> {
  return runAdminAction("categories:create", inlineCategorySchema, input, async ({ name }, actor) => {
    const base = slugify(name) || "category";
    const row = await prisma.$transaction(async (tx) => {
      const existing = await tx.category.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, name: true } });
      if (existing) return existing;
      const taken = await tx.category.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } });
      const used = new Set(taken.map((t) => t.slug));
      let slug = base;
      for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
      const last = await tx.category.aggregate({ where: { parentId: null }, _max: { sortOrder: true } });
      const created = await tx.category.create({ data: { name, slug, sortOrder: (last._max.sortOrder ?? 0) + 1 }, select: { id: true, name: true } });
      await logAudit({ actorId: actor.id, action: "category.create", entity: "Category", entityId: created.id, after: { name, slug } }, tx);
      return created;
    });
    updateTag(CacheTags.categories);
    return row;
  });
}
