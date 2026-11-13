/**
 * Cache tags for `"use cache"` reads (lib/queries) and their invalidation in
 * admin server actions (`updateTag`) or route handlers (`revalidateTag(tag, "max")`).
 * Tags are stored in plain text — never put personal data in them.
 */
export const CacheTags = {
  categories: "categories",
  products: "products",
  product: (slug: string) => `product:${slug}`,
  productsInCategory: (categorySlug: string) => `category-products:${categorySlug}`,
  reviews: (productId: string) => `reviews:${productId}`,
  coupons: "coupons",
  /** Store settings + shipping zones (lib/queries/settings.ts). */
  settings: "settings",
} as const;
