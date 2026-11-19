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
  /** Admin order aggregates (dashboard, badge counts). Order/payment mutations invalidate it. */
  orders: "orders",
  /** Admin Transactions aggregates (KPIs, per-method box, attention badge). Every payment/refund write invalidates it. */
  payments: "payments",
  /** Admin members + pending invites (Control Authority). */
  adminMembers: "admin-members",
} as const;
