import { z } from "zod";

const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only");

/** Dollars typed in admin forms → integer cents. */
export const centsFromDollars = z.coerce
  .number()
  .nonnegative()
  .transform((dollars) => Math.round(dollars * 100));

// Admin → Categories "Create New Category".
export const categorySchema = z.object({
  name: z.string().trim().min(1, "Required").max(80),
  slug,
  imageUrl: z.string().optional(),
  sortOrder: z.coerce.number().int().default(0),
});

export const variantSchema = z.object({
  sku: z.string().trim().min(1, "Required").max(40),
  name: z.string().trim().min(1, "Required").max(40),
  size: z.string().trim().max(40).optional(),
  color: z.string().trim().max(40).optional(),
  weightGrams: z.coerce.number().int().positive().optional(),
  priceCents: centsFromDollars,
  compareAtCents: centsFromDollars.optional(),
  stock: z.coerce.number().int().min(0),
  isDefault: z.boolean().default(false),
});

// Admin → Add Products.
export const productSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120),
  slug,
  code: z.string().trim().min(1, "Required").max(20),
  shortDescription: z.string().trim().max(300).optional(),
  description: z.string().trim().min(1, "Required"),
  brand: z.string().trim().max(60).optional(),
  productType: z.string().trim().max(60).optional(),
  tags: z.array(z.string().trim().min(1)).max(20).default([]),
  videoUrl: z.url().optional(),
  isFeatured: z.boolean().default(false),
  dealEndsAt: z.coerce.date().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("ACTIVE"),
  categoryId: z.string().min(1, "Choose a category"),
  variants: z.array(variantSchema).min(1, "Add at least one variant"),
});

// PDP → Customer Feedback.
export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(3, "Tell us a bit more").max(2000),
});

export const reviewPageSchema = z.object({
  productId: z.string().min(1),
  page: z.number().int().min(2).max(500),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
