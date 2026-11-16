import { z } from "zod";
import { SKU_RE, SLUG_RE } from "@/lib/admin/products/rules";
import { UPLOAD_MIME } from "@/lib/media/upload-rules";

/**
 * Admin → Add / Edit Product. The SAME schema runs in the browser
 * (react-hook-form zodResolver) and in the server action (runAdminAction).
 * Money is typed in taka (the form) and converted to poisha on the server.
 */

const id = z.string().trim().min(1).max(40);
const taka = z.number({ error: "Enter a price" }).finite().min(0, "Can't be negative").max(10_000_000, "Too large");
const optionalText = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
/** "" / null → null; otherwise an ISO date-time. */
const optionalDate = z
  .union([z.iso.datetime({ offset: true }), z.literal(""), z.null()])
  .transform((v) => (v ? v : null));

export const productSlugSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(120)
  .regex(SLUG_RE, "Lowercase letters, numbers and dashes only");

export const productSkuSchema = z
  .string()
  .trim()
  .min(1, "Required")
  .max(40)
  .regex(SKU_RE, "Letters, numbers, dot, dash and underscore only");

export const PRODUCT_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export const STOCK_STATUSES = ["IN_STOCK", "OUT_OF_STOCK"] as const;

/** Variant option types map to the Variant columns the storefront shows (size, color). */
export const VARIANT_OPTIONS = ["Size", "Color"] as const;

export const variantOptionSchema = z.object({
  name: z.enum(VARIANT_OPTIONS),
  values: z.array(z.string().trim().min(1).max(40)).min(1, "Add at least one value").max(20),
});

export const variantRowSchema = z
  .object({
    /** Existing Variant id (edit); absent for new rows. */
    id: id.optional(),
    /** Option combination key ("Color:Red|Size:1 kg"); "" for a single-variant product. */
    key: z.string().max(400),
    name: z.string().trim().min(1, "Required").max(60),
    sku: productSkuSchema,
    price: taka,
    discount: taka.nullable(),
    stock: z.number().int("Whole units").min(0, "Can't be negative").max(999_999, "Too many"),
    size: optionalText(40).nullable(),
    color: optionalText(40).nullable(),
    weightGrams: z.number().int().positive().max(1_000_000).nullable(),
  })
  .refine((v) => v.discount === null || v.discount < v.price, { message: "Discount must be less than the price", path: ["discount"] });

export const productImageInputSchema = z.object({
  mediaId: id,
  alt: optionalText(200),
  /** Variant combination key this image belongs to (null = whole product). */
  variantKey: z.string().max(400).nullable(),
});

export const productAttributeSchema = z.object({
  name: z.string().trim().min(1, "Required").max(60),
  value: z.string().trim().min(1, "Required").max(200),
});

export const productFormSchema = z
  .object({
    id: id.optional(),
    status: z.enum(PRODUCT_STATUSES),
    name: z.string().trim().min(1, "Enter the product name").max(120),
    slug: productSlugSchema,
    sku: productSkuSchema,
    shortDescription: optionalText(300),
    /** Tiptap HTML; sanitized again on the server (lib/rich-text.ts). */
    description: z.string().max(50_000, "Description is too long"),
    categoryId: z.string().min(1, "Choose a category"),
    tags: z.array(z.string().trim().min(1).max(40)).max(20, "At most 20 tags"),
    brand: optionalText(60),
    productType: optionalText(60),
    taxIncluded: z.boolean(),
    saleStartsAt: optionalDate,
    saleEndsAt: optionalDate,
    trackInventory: z.boolean(),
    stockStatus: z.enum(STOCK_STATUSES),
    lowStockThreshold: z.number().int().min(0).max(100_000),
    isFeatured: z.boolean(),
    seoTitle: optionalText(70),
    seoDescription: optionalText(160),
    options: z.array(variantOptionSchema).max(2, "Size and Color only"),
    variants: z.array(variantRowSchema).min(1, "Add at least one variant").max(100, "At most 100 variants"),
    attributes: z.array(productAttributeSchema).max(30),
    images: z.array(productImageInputSchema).max(20, "At most 20 images"),
  })
  .superRefine((v, ctx) => {
    if (v.saleStartsAt && v.saleEndsAt && new Date(v.saleEndsAt) <= new Date(v.saleStartsAt)) {
      ctx.addIssue({ code: "custom", path: ["saleEndsAt"], message: "End must be after the start" });
    }
    const skus = new Map<string, number>();
    v.variants.forEach((row, i) => {
      const k = row.sku.toLowerCase();
      if (skus.has(k)) ctx.addIssue({ code: "custom", path: ["variants", i, "sku"], message: "Duplicate SKU" });
      skus.set(k, i);
    });
    if (new Set(v.options.map((o) => o.name)).size !== v.options.length) {
      ctx.addIssue({ code: "custom", path: ["options"], message: "Each option once" });
    }
    const media = new Set<string>();
    v.images.forEach((img, i) => {
      if (media.has(img.mediaId)) ctx.addIssue({ code: "custom", path: ["images", i, "mediaId"], message: "Image added twice" });
      media.add(img.mediaId);
    });
    if (v.status === "PUBLISHED" && v.description.replace(/<[^>]*>/g, "").trim().length === 0) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "Add a description before publishing" });
    }
  });

export type ProductFormValues = z.input<typeof productFormSchema>;
export type ProductFormData = z.output<typeof productFormSchema>;

export const checkSlugSchema = z.object({ slug: productSlugSchema, excludeId: id.optional() });

export const productIdsSchema = z.object({ ids: z.array(id).min(1, "Select at least one product").max(200) });
export const bulkStatusSchema = productIdsSchema.extend({ status: z.enum(PRODUCT_STATUSES) });
export const bulkCategorySchema = productIdsSchema.extend({ categoryId: id });
export const productIdSchema = z.object({ id });

export const inlineCategorySchema = z.object({ name: z.string().trim().min(1, "Required").max(80) });

// ───────────── media ─────────────

export const uploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mime: z.enum(Object.keys(UPLOAD_MIME) as [keyof typeof UPLOAD_MIME, ...(keyof typeof UPLOAD_MIME)[]], {
    error: "Only JPG, PNG, WebP or AVIF images.",
  }),
  size: z.number().int().positive("The file is empty."),
  /** tmp: product form (moved into products/{id}/ on save); library: Product Media page. */
  scope: z.enum(["tmp", "library"]),
});

export const confirmUploadSchema = z.object({
  key: z.string().regex(/^(tmp|media)\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/, "Unknown upload"),
  fileName: z.string().trim().min(1).max(255),
});

export const mediaAltSchema = z.object({ id, alt: optionalText(200) });
export const mediaIdsSchema = z.object({ ids: z.array(id).min(1).max(200) });
