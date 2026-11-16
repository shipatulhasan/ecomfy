import "server-only";
import { prisma } from "@/lib/db";
import { availableStock, buildCartView, EMPTY_CART, lineIssue, type CartLine, type CartView } from "@/lib/cart/pricing";
import { cartWhere, resolveCartOwner, type CartOwner } from "@/lib/cart/owner";
import { firstImage, productImages } from "@/lib/catalog/images";

const imageLite = (rows: Parameters<typeof firstImage>[0], alt: string) => {
  const i = firstImage(rows, alt);
  return i ? { url: i.url, alt: i.alt } : null;
};

/**
 * The visitor's cart with every price, stock level and total computed here from
 * the DB (never from client input). Request-time and per-visitor: never
 * `"use cache"`. Callers render inside <Suspense>.
 */
export async function getCart(owner?: CartOwner | null): Promise<CartView> {
  const who = owner === undefined ? await resolveCartOwner() : owner;
  if (!who) return EMPTY_CART;

  const cart = await prisma.cart.findUnique({
    where: cartWhere(who),
    select: {
      coupon: {
        select: {
          code: true,
          type: true,
          value: true,
          minSubtotalCents: true,
          isActive: true,
          startsAt: true,
          endsAt: true,
          maxUses: true,
          usedCount: true,
        },
      },
      items: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          quantity: true,
          variant: {
            select: {
              id: true,
              name: true,
              priceCents: true,
              compareAtCents: true,
              stock: true,
              reserved: true,
              product: {
                select: {
                  id: true,
                  slug: true,
                  name: true,
                  status: true,
                  images: productImages(1),
                },
              },
            },
          },
        },
      },
    },
  });
  if (!cart) return EMPTY_CART;

  const lines: CartLine[] = cart.items.map(({ id, quantity, variant: v }) => {
    const stock = availableStock(v);
    return {
    id,
    variantId: v.id,
    productId: v.product.id,
    slug: v.product.slug,
    name: v.product.name,
    variantName: v.name,
    image: imageLite(v.product.images, v.product.name),
    unitCents: v.priceCents,
    compareAtCents: v.compareAtCents,
    quantity,
    stock,
    lineCents: v.priceCents * quantity,
    issue: lineIssue(quantity, stock, v.product.status === "PUBLISHED"),
    };
  });

  // The minimum spend is checked by computeTotals (and shown in the visitor's
  // currency by the coupon form), so `error` only carries availability problems.
  const coupon = cart.coupon
    ? {
        code: cart.coupon.code,
        type: cart.coupon.type,
        value: cart.coupon.value,
        minSubtotalCents: cart.coupon.minSubtotalCents,
        error: couponAvailabilityProblem(cart.coupon),
      }
    : null;

  return buildCartView(lines, coupon);
}

/** Why a coupon can't be used right now (ignoring the minimum spend), or null. */
export function couponAvailabilityProblem(
  c: { isActive: boolean; startsAt: Date | null; endsAt: Date | null; maxUses: number | null; usedCount: number },
  now = new Date(),
): string | null {
  if (!c.isActive) return "This coupon is no longer valid";
  if (c.startsAt && c.startsAt > now) return "This coupon isn't active yet";
  if (c.endsAt && c.endsAt < now) return "This coupon has expired";
  if (c.maxUses !== null && c.usedCount >= c.maxUses) return "This coupon has been fully redeemed";
  return null;
}
