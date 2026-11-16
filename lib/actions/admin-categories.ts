"use server";

import { randomUUID } from "node:crypto";
import { updateTag } from "next/cache";
import { adminCategorySelect, toAdminCategoryRow } from "@/lib/admin/categories/rows";
import type { AdminCategoryRow } from "@/lib/admin/categories/params";
import { logAudit } from "@/lib/audit";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { publicUrl, storage, storageKeys } from "@/lib/storage";
import {
  categoryFormSchema,
  categoryIdSchema,
  checkCategorySlugSchema,
  deleteCategorySchema,
  reorderCategoriesSchema,
  toggleCategorySchema,
  type CategoryFormData,
} from "@/lib/validations/admin-category";
import { ActionError, type ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Admin → Categories mutations. Each one re-checks `categories:write`
 * (runAdminAction: authorize, then validate with the same zod schema as the
 * modal), runs in one transaction with an audit entry, then expires the
 * storefront's category + product caches with updateTag() so the header menu,
 * Home and the Shop filters follow at once (read-your-own-writes).
 */

type Tx = Prisma.TransactionClient;
const FIX_FIELDS = "Please fix the highlighted fields.";

function invalidate(...categorySlugs: (string | null | undefined)[]) {
  updateTag(CacheTags.categories);
  updateTag(CacheTags.products); // Shop counts / filters, product category names
  for (const s of new Set(categorySlugs)) if (s) updateTag(CacheTags.productsInCategory(s));
}

const auditSelect = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  description: true,
  imageId: true,
  isActive: true,
  isFeatured: true,
  sortOrder: true,
  seoTitle: true,
  seoDescription: true,
} satisfies Prisma.CategorySelect;

function omitCount<T extends { _count: unknown }>(row: T): Omit<T, "_count"> {
  const out: Partial<T> = { ...row };
  delete out._count;
  return out as Omit<T, "_count">;
}

async function freeSlug(base: string, excludeId?: string, db: Tx | typeof prisma = prisma): Promise<string> {
  const rows = await db.category.findMany({
    where: { slug: { startsWith: base }, ...(excludeId && { id: { not: excludeId } }) },
    select: { slug: true },
  });
  const used = new Set(rows.map((r) => r.slug));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

// ───────────────────────────── create / update ─────────────────────────────

/** Modal → Save (new category). */
export async function createCategory(input: unknown): Promise<ActionResult<AdminCategoryRow>> {
  return runAdminAction("categories:write", categoryFormSchema, input, (data, actor) => saveCategory({ ...data, id: undefined }, actor.id));
}

/** Modal → Save (edit). A slug change leaves a CATEGORY SlugRedirect (old Shop URL → 308). */
export async function updateCategory(input: unknown): Promise<ActionResult<AdminCategoryRow>> {
  return runAdminAction("categories:write", categoryFormSchema, input, (data, actor) => {
    if (!data.id) throw new ActionError("Missing category id.");
    return saveCategory(data, actor.id);
  });
}

async function saveCategory(data: CategoryFormData, actorId: string): Promise<AdminCategoryRow> {
  const before = data.id
    ? await prisma.category.findUnique({ where: { id: data.id }, select: { ...auditSelect, _count: { select: { children: true } } } })
    : null;
  if (data.id && !before) throw new ActionError("This category no longer exists.");
  const id = data.id ?? randomUUID();

  // Slug: unique across categories.
  const slugOwner = await prisma.category.findUnique({ where: { slug: data.slug }, select: { id: true } });
  if (slugOwner && slugOwner.id !== id) {
    throw new ActionError(FIX_FIELDS, { slug: [`Already used. Try “${await freeSlug(data.slug, id)}”.`] });
  }

  // Parent: one level. The parent must be top-level, and a category with
  // subcategories stays top-level.
  if (data.parentId) {
    if (data.parentId === id) throw new ActionError(FIX_FIELDS, { parentId: ["A category can't be its own parent"] });
    const parent = await prisma.category.findUnique({ where: { id: data.parentId }, select: { parentId: true } });
    if (!parent) throw new ActionError(FIX_FIELDS, { parentId: ["That category no longer exists"] });
    if (parent.parentId) throw new ActionError(FIX_FIELDS, { parentId: ["Pick a top-level category (one level of nesting)"] });
    if (before && before._count.children > 0) {
      throw new ActionError(FIX_FIELDS, { parentId: ["It has subcategories, so it must stay top-level"] });
    }
  }

  // Image: tmp uploads move into categories/{id}/ before the transaction (S3 isn't transactional).
  const media = data.imageId ? await prisma.media.findUnique({ where: { id: data.imageId }, select: { id: true, key: true } }) : null;
  if (data.imageId && !media) throw new ActionError(FIX_FIELDS, { imageId: ["That image was deleted meanwhile. Pick another one."] });
  const move =
    media && storageKeys.isTmp(media.key)
      ? { from: media.key, to: storageKeys.category(id, randomUUID(), media.key.split(".").pop()!) }
      : null;
  if (move) await storage.copy(move.from, move.to);

  let row;
  try {
    row = await prisma.$transaction(async (tx) => {
      if (move && media) await tx.media.update({ where: { id: media.id }, data: { key: move.to, url: publicUrl(move.to) } });
      if (media) await tx.media.update({ where: { id: media.id }, data: { alt: data.imageAlt } });

      const moved = before && before.parentId !== data.parentId;
      const sortOrder =
        !before || moved
          ? ((await tx.category.aggregate({ where: { parentId: data.parentId }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1
          : before.sortOrder;
      const fields = {
        name: data.name,
        slug: data.slug,
        parentId: data.parentId,
        description: data.description,
        imageId: data.imageId,
        isActive: data.isActive,
        isFeatured: data.isFeatured,
        sortOrder,
        seoTitle: data.seoTitle || null,
        seoDescription: data.seoDescription || null,
      };
      const saved = before
        ? await tx.category.update({ where: { id }, data: fields, select: adminCategorySelect })
        : await tx.category.create({ data: { id, ...fields }, select: adminCategorySelect });

      // The new slug can't stay a redirect; the old one now points here.
      await tx.slugRedirect.deleteMany({ where: { kind: "CATEGORY", fromSlug: data.slug } });
      if (before && before.slug !== data.slug) {
        await tx.slugRedirect.upsert({
          where: { kind_fromSlug: { kind: "CATEGORY", fromSlug: before.slug } },
          create: { kind: "CATEGORY", fromSlug: before.slug, categoryId: id },
          update: { categoryId: id },
        });
      }

      const beforeSnap = before ? omitCount(before) : null;
      await logAudit(
        {
          actorId,
          action: before ? "category.update" : "category.create",
          entity: "Category",
          entityId: id,
          before: beforeSnap,
          after: { ...fields, imageAlt: data.imageAlt },
        },
        tx,
      );
      return saved;
    });
  } catch (err) {
    if (move) await storage.delete([move.to]).catch(() => {});
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ActionError(FIX_FIELDS, { slug: ["That slug was just taken. Change it and save again."] });
    }
    throw err;
  }
  if (move) await storage.delete([move.from]).catch((e) => console.error("[categories] tmp cleanup", e));

  invalidate(before?.slug, row.slug);
  return toAdminCategoryRow(row);
}

// ───────────────────────────── slug check ─────────────────────────────

/** Slug field blur: is it free? (Saving re-checks.) */
export async function checkCategorySlug(input: unknown): Promise<ActionResult<{ available: boolean; suggestion: string }>> {
  return runAdminAction("categories:write", checkCategorySlugSchema, input, async ({ slug, excludeId }) => {
    const taken = await prisma.category.findFirst({ where: { slug, ...(excludeId && { id: { not: excludeId } }) }, select: { id: true } });
    return { available: !taken, suggestion: taken ? await freeSlug(slug, excludeId) : slug };
  });
}

// ───────────────────────────── toggle ─────────────────────────────

/** Row "⋯" / bulk bar → Activate / Deactivate, Feature on home / Remove from home. */
export async function toggleCategory(input: unknown): Promise<ActionResult<{ updated: number }>> {
  return runAdminAction("categories:write", toggleCategorySchema, input, async ({ ids, field, value }, actor) => {
    const rows = await prisma.$transaction(async (tx) => {
      const before = await tx.category.findMany({ where: { id: { in: ids } }, select: { id: true, slug: true, isActive: true, isFeatured: true } });
      if (before.length === 0) throw new ActionError("These categories no longer exist.");
      const changed = before.filter((r) => r[field] !== value);
      await tx.category.updateMany({ where: { id: { in: changed.map((r) => r.id) } }, data: { [field]: value } });
      await logAudit(
        {
          actorId: actor.id,
          action: "category.toggle",
          entity: "Category",
          entityId: changed.length === 1 ? changed[0]!.id : null,
          before: { ids: changed.map((r) => r.id), [field]: !value },
          after: { ids: changed.map((r) => r.id), [field]: value },
        },
        tx,
      );
      return changed;
    });
    invalidate(...rows.map((r) => r.slug));
    return { updated: rows.length };
  });
}

// ───────────────────────────── reorder ─────────────────────────────

/**
 * Drag to reorder within one parent. `ids` are the siblings on screen in their
 * new order (a page may show only some of them): they take over the positions
 * they held among all siblings, so rows on other pages keep their place.
 */
export async function reorderCategories(input: unknown): Promise<ActionResult<{ updated: number }>> {
  return runAdminAction("categories:write", reorderCategoriesSchema, input, async ({ parentId, ids }, actor) => {
    if (new Set(ids).size !== ids.length) throw new ActionError("Duplicate ids.");
    const updated = await prisma.$transaction(async (tx) => {
      const siblings = await tx.category.findMany({
        where: { parentId },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, sortOrder: true },
      });
      const moving = new Set(ids);
      if (ids.some((id) => !siblings.some((s) => s.id === id))) {
        throw new ActionError("The list changed meanwhile. Reload and try again.");
      }
      const queue = [...ids];
      const order = siblings.map((s) => (moving.has(s.id) ? queue.shift()! : s.id));
      let n = 0;
      for (const [sortOrder, id] of order.entries()) {
        if (siblings.find((s) => s.id === id)!.sortOrder === sortOrder) continue;
        await tx.category.update({ where: { id }, data: { sortOrder } });
        n++;
      }
      await logAudit(
        { actorId: actor.id, action: "category.reorder", entity: "Category", before: { parentId, order: siblings.map((s) => s.id) }, after: { parentId, order } },
        tx,
      );
      return n;
    });
    invalidate();
    return { updated };
  });
}

// ───────────────────────────── delete ─────────────────────────────

export type CategoryDeleteInfo = {
  id: string;
  name: string;
  /** Every product in it, hidden (soft-deleted) ones included: they'd be orphaned too. */
  products: number;
  children: { id: string; name: string }[];
  /** Where its products can move: every other category. */
  targets: { id: string; name: string }[];
};

/** Delete dialog: what blocks the delete, and where products can go. */
export async function getCategoryDeleteInfo(input: unknown): Promise<ActionResult<CategoryDeleteInfo>> {
  return runAdminAction("categories:write", categoryIdSchema, input, async ({ id }) => {
    const [row, others] = await Promise.all([
      prisma.category.findUnique({
        where: { id },
        select: { id: true, name: true, _count: { select: { products: true } }, children: { select: { id: true, name: true }, orderBy: { sortOrder: "asc" } } },
      }),
      prisma.category.findMany({
        where: { id: { not: id } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, parentId: true, parent: { select: { name: true, sortOrder: true } } },
      }),
    ]);
    if (!row) throw new ActionError("This category no longer exists.");
    const top = others.filter((o) => !o.parentId);
    const targets = [
      ...top.flatMap((t) => [{ id: t.id, name: t.name }, ...others.filter((o) => o.parentId === t.id).map((o) => ({ id: o.id, name: `${t.name} › ${o.name}` }))]),
      // Children of the category being deleted (their parent is it, so not in `top`).
      ...others.filter((o) => o.parentId === id).map((o) => ({ id: o.id, name: `${row.name} › ${o.name}` })),
    ];
    return { id: row.id, name: row.name, products: row._count.products, children: row.children, targets };
  });
}

/**
 * Delete a category. Blocked while it has subcategories. With products, the
 * caller must pick `moveProductsTo`: they move there in the same transaction, so
 * no product is ever left without a category.
 */
export async function deleteCategory(input: unknown): Promise<ActionResult<{ id: string; moved: number }>> {
  return runAdminAction("categories:write", deleteCategorySchema, input, async ({ id, moveProductsTo }, actor) => {
    const row = await prisma.category.findUnique({
      where: { id },
      select: { ...auditSelect, _count: { select: { products: true, children: true } } },
    });
    if (!row) throw new ActionError("This category no longer exists.");
    if (row._count.children > 0) {
      throw new ActionError(`“${row.name}” has ${row._count.children} subcategor${row._count.children === 1 ? "y" : "ies"}. Move or delete them first.`);
    }
    let target: { id: string; slug: string } | null = null;
    if (row._count.products > 0) {
      if (!moveProductsTo) throw new ActionError(`“${row.name}” has ${row._count.products} product${row._count.products === 1 ? "" : "s"}. Choose where to move them first.`);
      if (moveProductsTo === id) throw new ActionError("Pick a different category for its products.");
      target = await prisma.category.findUnique({ where: { id: moveProductsTo }, select: { id: true, slug: true } });
      if (!target) throw new ActionError("The category you picked no longer exists.");
    }

    const moved = await prisma.$transaction(async (tx) => {
      const { count } = target ? await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: target.id } }) : { count: 0 };
      // Re-check inside the transaction: a product added meanwhile would block the FK (Restrict).
      await tx.category.delete({ where: { id } });
      const before = omitCount(row);
      await logAudit(
        { actorId: actor.id, action: "category.delete", entity: "Category", entityId: id, before, after: target ? { movedProductsTo: target.id, moved: count } : null },
        tx,
      );
      return count;
    });
    invalidate(row.slug, target?.slug);
    return { id, moved };
  });
}
