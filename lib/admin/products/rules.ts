/**
 * Product rules shared by the admin form (client), the server actions and the
 * seed. Pure functions only: no Prisma, no server-only imports.
 */

/**
 * "Unlimited" (trackInventory = false) products keep a large sentinel stock so
 * the storefront, cart and checkout need no special case; the save action and
 * the admin UI treat it as ∞. OUT_OF_STOCK stores 0.
 */
export const UNLIMITED_STOCK = 1_000_000;

export type StockLevel = "in" | "low" | "out" | "unlimited";

export function stockLevel(p: { stock: number; trackInventory: boolean; lowStockThreshold: number }): StockLevel {
  if (!p.trackInventory) return p.stock > 0 ? "unlimited" : "out";
  if (p.stock <= 0) return "out";
  return p.stock <= p.lowStockThreshold ? "low" : "in";
}

/**
 * Current selling price from the admin's regular price, optional sale price and
 * sale window ("Expiration"). Outside the window the regular price applies.
 * Re-applied on save and by the 5-minute cron (lib/admin/products/schedule.ts).
 */
export function derivePrice(
  v: { regularPriceCents: number; salePriceCents: number | null },
  window: { saleStartsAt: Date | null; dealEndsAt: Date | null },
  now = new Date(),
): { priceCents: number; compareAtCents: number | null } {
  const sale = v.salePriceCents;
  const open =
    sale !== null &&
    sale < v.regularPriceCents &&
    (!window.saleStartsAt || window.saleStartsAt <= now) &&
    (!window.dealEndsAt || window.dealEndsAt > now);
  return open ? { priceCents: sale, compareAtCents: v.regularPriceCents } : { priceCents: v.regularPriceCents, compareAtCents: null };
}

export const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SKU_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/** taka (form) → poisha (DB), and back. */
export const toPoisha = (taka: number) => Math.round(taka * 100);
export const toTaka = (poisha: number) => poisha / 100;

/** Variant combination key, stable across edits: "Color:Red|Size:1 kg". */
export const variantKey = (values: Record<string, string>) =>
  Object.keys(values)
    .sort()
    .map((k) => `${k}:${values[k]}`)
    .join("|");

/** Cartesian product of option values → one record per variant. */
export function combinations(options: { name: string; values: string[] }[]): Record<string, string>[] {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0);
  return usable.reduce<Record<string, string>[]>(
    (acc, o) => acc.flatMap((combo) => o.values.map((v) => ({ ...combo, [o.name.trim()]: v }))),
    [{}],
  ).filter((c) => Object.keys(c).length > 0);
}
