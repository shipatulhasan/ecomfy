import { z } from "zod";
import { SLUG_RE } from "@/lib/admin/products/rules";

/**
 * Admin → Categories. The SAME schema runs in the browser (react-hook-form
 * zodResolver, the Create / Edit Category modal) and in the server actions
 * (runAdminAction), so client and server errors match.
 */

const id = z.string().trim().min(1).max(40);

export const CATEGORY_LIMITS = { name: 80, description: 500, alt: 150, seoTitle: 60, seoDescription: 160 } as const;

const text = (max: number) => z.string().trim().max(max, `At most ${max} characters`);

export const categorySlugSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(120)
  .regex(SLUG_RE, "Lowercase letters, numbers and dashes only");

export const categoryFormSchema = z.object({
  /** Present when editing. */
  id: id.optional(),
  name: z.string().trim().min(1, "Enter a category name").max(CATEGORY_LIMITS.name, `At most ${CATEGORY_LIMITS.name} characters`),
  slug: categorySlugSchema,
  /** null = top level. */
  parentId: id.nullable(),
  description: text(CATEGORY_LIMITS.description),
  imageId: id.nullable(),
  imageAlt: text(CATEGORY_LIMITS.alt),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  seoTitle: text(CATEGORY_LIMITS.seoTitle),
  seoDescription: text(CATEGORY_LIMITS.seoDescription),
});

export type CategoryFormValues = z.input<typeof categoryFormSchema>;
export type CategoryFormData = z.output<typeof categoryFormSchema>;

export const categoryIdSchema = z.object({ id });

export const checkCategorySlugSchema = z.object({ slug: categorySlugSchema, excludeId: id.optional() });

/** Drag to reorder: the siblings on screen (under one parent) in their new order. */
export const reorderCategoriesSchema = z.object({
  parentId: id.nullable(),
  ids: z.array(id).min(1).max(500),
});

export const toggleCategorySchema = z.object({
  /** One row (row menu) or the selected rows (bulk bar). */
  ids: z.array(id).min(1).max(200),
  field: z.enum(["isActive", "isFeatured"]),
  value: z.boolean(),
});

export const deleteCategorySchema = z.object({
  id,
  /** Required when the category still has products: they move here first. */
  moveProductsTo: id.optional(),
});
