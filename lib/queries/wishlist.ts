import "server-only";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-guards";
import { readGuestWishlist } from "@/lib/wishlist-cookie";
import { firstImage, productImages } from "@/lib/catalog/images";

/**
 * Wishlist for the signed-in user (Wishlist table) or the guest (cookie ids,
 * checked against the DB). Request-time, never cached; render inside <Suspense>.
 */
export type WishlistVariant = { id: string; name: string; priceCents: number; compareAtCents: number | null; stock: number };

export type WishlistRow = {
  productId: string;
  slug: string;
  name: string;
  image: { url: string; alt: string } | null;
  /** Default variant's price (what cards show). */
  priceCents: number;
  compareAtCents: number | null;
  /** Total units across options. */
  stock: number;
  /** Default first. 2+ → Add to Cart opens the option picker. */
  variants: WishlistVariant[];
};

const rowSelect = {
  id: true,
  slug: true,
  name: true,
  status: true,
  images: productImages(1),
  variants: {
    orderBy: [{ isDefault: "desc" as const }, { createdAt: "asc" as const }],
    select: { id: true, name: true, priceCents: true, compareAtCents: true, stock: true },
  },
};

/** Product ids on the visitor's wishlist, newest first. */
export async function getWishlistIds(): Promise<string[]> {
  const user = await getCurrentUser();
  if (user) {
    const rows = await prisma.wishlist.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { productId: true },
    });
    return rows.map((r) => r.productId);
  }
  const ids = await readGuestWishlist();
  if (ids.length === 0) return [];
  // Cookie ids are untrusted: keep only live products, in cookie order.
  const live = await prisma.product.findMany({ where: { id: { in: ids }, status: "PUBLISHED" }, select: { id: true } });
  const ok = new Set(live.map((p) => p.id));
  return ids.filter((id) => ok.has(id));
}

export async function getWishlist(): Promise<WishlistRow[]> {
  const ids = await getWishlistIds();
  if (ids.length === 0) return [];
  const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: rowSelect });
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.flatMap((id) => {
    const p = byId.get(id);
    const first = p?.variants[0];
    if (!p || !first || p.status !== "PUBLISHED") return [];
    return [
      {
        productId: p.id,
        slug: p.slug,
        name: p.name,
        image: (() => { const i = firstImage(p.images, p.name); return i ? { url: i.url, alt: i.alt } : null; })(),
        priceCents: first.priceCents,
        compareAtCents: first.compareAtCents,
        stock: p.variants.reduce((n, v) => n + Math.max(0, v.stock), 0),
        variants: p.variants,
      },
    ];
  });
}
