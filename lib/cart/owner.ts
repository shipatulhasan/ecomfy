import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-guards";
import { readGuestCartToken, writeGuestCartToken } from "@/lib/cart-cookie";

/**
 * Who the cart / wishlist belongs to: the signed-in user, else the guest cookie.
 * Always resolved on the server from the session and cookies, never from input.
 */
export type CartOwner = { userId: string } | { guestToken: string };

export async function resolveCartOwner(): Promise<CartOwner | null> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id };
  const guestToken = await readGuestCartToken();
  return guestToken ? { guestToken } : null;
}

export const cartWhere = (owner: CartOwner) =>
  "userId" in owner ? { userId: owner.userId } : { guestToken: owner.guestToken };

/** The owner's cart id, or null when there is none yet. */
export async function findCartId(owner: CartOwner | null): Promise<string | null> {
  if (!owner) return null;
  const cart = await prisma.cart.findUnique({ where: cartWhere(owner), select: { id: true } });
  return cart?.id ?? null;
}

/**
 * The visitor's cart, created on first use. Guests get a new random token in an
 * httpOnly cookie, so this is only callable from a Server Action.
 */
export async function getOrCreateCart(): Promise<{ cartId: string; owner: CartOwner }> {
  const user = await getCurrentUser();
  if (user) {
    const cart = await prisma.cart.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
      select: { id: true },
    });
    return { cartId: cart.id, owner: { userId: user.id } };
  }

  const existing = await readGuestCartToken();
  if (existing) {
    const cart = await prisma.cart.findUnique({ where: { guestToken: existing }, select: { id: true } });
    if (cart) return { cartId: cart.id, owner: { guestToken: existing } };
  }
  const guestToken = randomUUID();
  const cart = await prisma.cart.create({ data: { guestToken }, select: { id: true } });
  await writeGuestCartToken(guestToken);
  return { cartId: cart.id, owner: { guestToken } };
}
