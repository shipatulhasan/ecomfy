import "server-only";
import { prisma } from "@/lib/db";
import { derivePrice } from "./rules";

/**
 * Sale windows ("Expiration" start/end on Add Product): re-derive each variant's
 * selling price when a window opens or closes. Run by the 5-minute cron
 * (app/api/cron/expire-orders); saves apply it immediately. Returns the slugs
 * whose prices changed so the caller can expire their cache tags.
 */
export async function syncScheduledPrices(now = new Date()): Promise<{ slugs: string[]; categorySlugs: string[] }> {
  const variants = await prisma.variant.findMany({
    where: {
      salePriceCents: { not: null },
      product: { deletedAt: null, OR: [{ saleStartsAt: { not: null } }, { dealEndsAt: { not: null } }] },
    },
    select: {
      id: true,
      isDefault: true,
      priceCents: true,
      compareAtCents: true,
      regularPriceCents: true,
      salePriceCents: true,
      product: { select: { id: true, slug: true, saleStartsAt: true, dealEndsAt: true, category: { select: { slug: true } } } },
    },
  });

  const slugs = new Set<string>();
  const categorySlugs = new Set<string>();
  for (const v of variants) {
    const next = derivePrice(v, v.product, now);
    if (next.priceCents === v.priceCents && next.compareAtCents === v.compareAtCents) continue;
    await prisma.$transaction([
      prisma.variant.update({ where: { id: v.id }, data: next }),
      ...(v.isDefault ? [prisma.product.update({ where: { id: v.product.id }, data: { priceCents: next.priceCents } })] : []),
    ]);
    slugs.add(v.product.slug);
    categorySlugs.add(v.product.category.slug);
  }
  return { slugs: [...slugs], categorySlugs: [...categorySlugs] };
}
