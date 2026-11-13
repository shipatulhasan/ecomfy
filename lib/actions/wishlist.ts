"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-guards";
import { addVariantToCart } from "@/lib/cart/mutations";
import type { CartView } from "@/lib/cart/pricing";
import { MAX_GUEST_WISHLIST } from "@/lib/config/cart";
import { getCart } from "@/lib/queries/cart";
import { readGuestWishlist, writeGuestWishlist } from "@/lib/wishlist-cookie";
import { moveToCartSchema, removeFromWishlistSchema, toggleWishlistSchema } from "@/lib/validations/wishlist";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Wishlist mutations. Public by design: signed-in users write the Wishlist table,
 * guests an httpOnly cookie that merges on sign-in (lib/cart/merge.ts). The
 * session is resolved here on every call.
 */

async function assertLiveProduct(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { status: true } });
  if (!product || product.status !== "ACTIVE") throw new ActionError("This product is no longer available.");
}

async function setWishlisted(productId: string, on: boolean) {
  const user = await getCurrentUser();
  if (user) {
    const key = { userId_productId: { userId: user.id, productId } };
    if (on) await prisma.wishlist.upsert({ where: key, create: { userId: user.id, productId }, update: {} });
    else await prisma.wishlist.deleteMany({ where: { userId: user.id, productId } });
    return;
  }
  const ids = (await readGuestWishlist()).filter((id) => id !== productId);
  await writeGuestWishlist(on ? [productId, ...ids].slice(0, MAX_GUEST_WISHLIST) : ids);
}

async function isWishlisted(productId: string) {
  const user = await getCurrentUser();
  if (user) {
    const row = await prisma.wishlist.findUnique({
      where: { userId_productId: { userId: user.id, productId } },
      select: { productId: true },
    });
    return row !== null;
  }
  return (await readGuestWishlist()).includes(productId);
}

/** Heart toggle (cards, Quick View, PDP) and "Undo" on the Wishlist page. */
export async function toggleWishlist(input: unknown): Promise<ActionResult<{ wishlisted: boolean }>> {
  return runAction(toggleWishlistSchema, input, async ({ productId }) => {
    const next = !(await isWishlisted(productId));
    if (next) await assertLiveProduct(productId);
    await setWishlisted(productId, next);
    refresh();
    return { wishlisted: next };
  });
}

/** Wishlist ✕. */
export async function removeFromWishlist(input: unknown): Promise<ActionResult<{ wishlisted: false }>> {
  return runAction(removeFromWishlistSchema, input, async ({ productId }) => {
    await setWishlisted(productId, false);
    refresh();
    return { wishlisted: false as const };
  });
}

/**
 * Wishlist "Add to Cart": adds one unit of the chosen option. The item stays on
 * the wishlist (the design keeps it there).
 */
export async function moveToCart(input: unknown): Promise<ActionResult<CartView>> {
  return runAction(moveToCartSchema, input, async ({ productId, variantId }) => {
    const variant = await prisma.variant.findUnique({ where: { id: variantId }, select: { productId: true } });
    if (!variant || variant.productId !== productId) throw new ActionError("This option is no longer available.");
    const owner = await addVariantToCart(variantId, 1);
    refresh();
    return getCart(owner);
  });
}
