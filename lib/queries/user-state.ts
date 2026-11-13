import "server-only";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-guards";
import { readGuestCartToken } from "@/lib/cart-cookie";

/**
 * Per-visitor storefront state (header cart total, wishlist hearts, auth links).
 * Request-time and never cached — callers render inside <Suspense>.
 */
export type CartSummary = { count: number; totalCents: number };
export type ShopUserState = {
  user: { name: string } | null;
  cart: CartSummary;
  wishlist: string[]; // product ids
};

/** Cart for a user id, else for a guest token. */
export async function getCartSummary(
  owner: { userId: string } | { guestToken: string } | null,
): Promise<CartSummary> {
  if (!owner) return { count: 0, totalCents: 0 };
  const items = await prisma.cartItem.findMany({
    where: { cart: "userId" in owner ? { userId: owner.userId } : { guestToken: owner.guestToken } },
    select: { quantity: true, variant: { select: { priceCents: true } } },
  });
  return items.reduce(
    (sum, i) => ({
      count: sum.count + i.quantity,
      totalCents: sum.totalCents + i.quantity * i.variant.priceCents,
    }),
    { count: 0, totalCents: 0 },
  );
}

export async function getShopUserState(): Promise<ShopUserState> {
  const user = await getCurrentUser();
  if (!user) {
    const guestToken = await readGuestCartToken();
    return {
      user: null,
      cart: await getCartSummary(guestToken ? { guestToken } : null),
      wishlist: [],
    };
  }
  const [cart, wishlist] = await Promise.all([
    getCartSummary({ userId: user.id }),
    prisma.wishlist.findMany({ where: { userId: user.id }, select: { productId: true } }),
  ]);
  return { user: { name: user.name }, cart, wishlist: wishlist.map((w) => w.productId) };
}
