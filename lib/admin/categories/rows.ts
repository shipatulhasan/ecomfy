import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { mediaUrl } from "@/lib/storage/core";
import type { AdminCategoryRow } from "./params";

/** Shared by the admin list query and the actions (they return the saved row). */
export const adminCategorySelect = {
  id: true,
  name: true,
  slug: true,
  parentId: true,
  description: true,
  isActive: true,
  isFeatured: true,
  sortOrder: true,
  seoTitle: true,
  seoDescription: true,
  createdAt: true,
  imageId: true,
  image: { select: { key: true, alt: true, blurDataURL: true } },
  _count: { select: { products: { where: { deletedAt: null } }, children: true } },
} satisfies Prisma.CategorySelect;

export type AdminCategoryRecord = Prisma.CategoryGetPayload<{ select: typeof adminCategorySelect }>;

export function toAdminCategoryRow(c: AdminCategoryRecord): AdminCategoryRow {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    parentId: c.parentId,
    description: c.description,
    imageId: c.imageId,
    imageUrl: c.image ? mediaUrl(c.image.key) : null,
    imageAlt: c.image?.alt ?? "",
    blurDataURL: c.image?.blurDataURL ?? null,
    isActive: c.isActive,
    isFeatured: c.isFeatured,
    sortOrder: c.sortOrder,
    seoTitle: c.seoTitle ?? "",
    seoDescription: c.seoDescription ?? "",
    productCount: c._count.products,
    childCount: c._count.children,
    createdAt: c.createdAt.toISOString(),
  };
}
