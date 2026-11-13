import { z } from "zod";
import { DEFAULT_SORT, SHOP_SORTS, type ShopFilters } from "@/lib/shop-params";

/**
 * Shop searchParams → validated ShopFilters. Every field falls back (`.catch`) instead
 * of throwing, so a hand-edited URL never 500s; it just ignores the bad value.
 * Only `page` is reported back as invalid, so the page can redirect to a clean URL.
 */
type RawParams = Record<string, string | string[] | undefined>;

/** First value of a param; "" counts as absent. */
const one = (v: unknown) => {
  const x = Array.isArray(v) ? v[0] : v;
  return x === "" ? undefined : x;
};
/** All values of a repeatable param. */
const many = (v: unknown) => (v == null ? [] : Array.isArray(v) ? v : [v]);

const label = z.string().trim().min(1).max(40);
const list = z.preprocess(
  many,
  z
    .array(z.unknown())
    .transform((xs) => [...new Set(xs.flatMap((x) => (label.safeParse(x).success ? [String(x).trim()] : [])))].slice(0, 10)),
);
const dollars = z.preprocess(one, z.coerce.number().int().min(0).max(100_000).optional()).catch(undefined);

export const shopSearchParamsSchema = z.object({
  category: z
    .preprocess(one, z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120).optional())
    .catch(undefined),
  q: z.preprocess(one, z.string().trim().max(100).optional()).catch(undefined),
  min: dollars,
  max: dollars,
  rating: z.preprocess(one, z.coerce.number().int().min(1).max(5).optional()).catch(undefined),
  tag: list.catch([]),
  brand: list.catch([]),
  stock: z.preprocess(one, z.literal("in").optional()).catch(undefined),
  sort: z.preprocess(one, z.enum(SHOP_SORTS).default(DEFAULT_SORT)).catch(DEFAULT_SORT),
});

export function parseShopParams(raw: RawParams): { filters: ShopFilters; pageInvalid: boolean } {
  const p = shopSearchParamsSchema.parse(raw);

  // page: absent → 1. Anything that isn't a plain positive integer is invalid.
  const rawPage = one(raw.page);
  const pageOk = rawPage === undefined || (typeof rawPage === "string" && /^[1-9]\d{0,5}$/.test(rawPage));
  const page = pageOk && rawPage ? Number(rawPage) : 1;

  let { min, max } = p;
  if (min != null && max != null && min > max) [min, max] = [max, min];

  return {
    filters: {
      category: p.category,
      q: p.q || undefined,
      min,
      max,
      rating: p.rating,
      tags: p.tag,
      brands: p.brand,
      inStock: p.stock === "in",
      sort: p.sort,
      page,
    },
    pageInvalid: !pageOk,
  };
}
