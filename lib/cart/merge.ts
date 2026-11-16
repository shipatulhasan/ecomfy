import "server-only";
import { prisma } from "@/lib/db";
import { MAX_CART_QTY } from "@/lib/config/product";
import { availableStock } from "./pricing";

/**
 * Fold a guest cart and a guest wishlist into a user's account on sign-in / sign-up
 * (called from the Better Auth after-hook in lib/auth.ts).
 *
 * - Cart: quantities of the same variant are summed and capped at stock (and
 *   MAX_CART_QTY). The guest coupon carries over when the user's cart has none.
 *   The guest cart is then deleted.
 * - Wishlist: guest product ids are added (duplicates skipped, dead ids dropped).
 */
export async function mergeGuestIntoUser(userId: string, guestToken: string | null, guestWishlist: string[]) {
  if (guestToken) await mergeCart(userId, guestToken);
  if (guestWishlist.length > 0) {
    const live = await prisma.product.findMany({
      where: { id: { in: guestWishlist }, status: "PUBLISHED" },
      select: { id: true },
    });
    if (live.length > 0) {
      await prisma.wishlist.createMany({
        data: live.map((p) => ({ userId, productId: p.id })),
        skipDuplicates: true,
      });
    }
  }
}

async function mergeCart(userId: string, guestToken: string) {
  await prisma.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({
      where: { guestToken },
      select: {
        id: true,
        userId: true,
        couponId: true,
        items: { select: { variantId: true, quantity: true, variant: { select: { stock: true, reserved: true } } } },
      },
    });
    if (!guest || guest.userId) return;

    const userCart = await tx.cart.upsert({
      where: { userId },
      create: { userId, couponId: guest.couponId },
      update: {},
      select: { id: true, couponId: true, items: { select: { variantId: true, quantity: true } } },
    });
    const existing = new Map(userCart.items.map((i) => [i.variantId, i.quantity]));

    for (const item of guest.items) {
      const cap = Math.min(availableStock(item.variant), MAX_CART_QTY);
      if (cap <= 0) continue;
      const quantity = Math.min(cap, (existing.get(item.variantId) ?? 0) + item.quantity);
      await tx.cartItem.upsert({
        where: { cartId_variantId: { cartId: userCart.id, variantId: item.variantId } },
        create: { cartId: userCart.id, variantId: item.variantId, quantity },
        update: { quantity },
      });
    }
    if (!userCart.couponId && guest.couponId) {
      await tx.cart.update({ where: { id: userCart.id }, data: { couponId: guest.couponId } });
    }
    await tx.cart.delete({ where: { id: guest.id } });
  });
}
