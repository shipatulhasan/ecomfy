"use server";

import { refresh } from "next/cache";
import { prisma } from "@/lib/db";
import { addVariantToCart } from "@/lib/cart/mutations";
import { findCartId, resolveCartOwner } from "@/lib/cart/owner";
import { couponMinimumProblem, maxLineQuantity, type CartView } from "@/lib/cart/pricing";
import { couponAvailabilityProblem, getCart } from "@/lib/queries/cart";
import {
  addToCartSchema,
  couponSchema,
  emptySchema,
  removeItemSchema,
  updateQuantitySchema,
} from "@/lib/validations/cart";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Cart mutations. Every action returns the whole recomputed cart (prices, stock
 * and totals from the DB), which the client store adopts, and calls `refresh()`
 * so server-rendered cart views re-render too.
 *
 * Auth: public by design. Signed-out visitors get a guest cart (httpOnly cookie
 * token, `Cart.guestToken`). The owner is resolved here from the session/cookie,
 * never from input, and line ids are only matched inside the owner's cart, so a
 * forged id can't touch someone else's cart.
 */

async function done(owner?: Awaited<ReturnType<typeof resolveCartOwner>>): Promise<CartView> {
  refresh();
  return getCart(owner);
}

/** The owner's cart id or a shopper-facing error. */
async function requireCart() {
  const owner = await resolveCartOwner();
  const cartId = await findCartId(owner);
  if (!owner || !cartId) throw new ActionError("Your cart is empty.");
  return { owner, cartId };
}

export async function addToCart(input: unknown): Promise<ActionResult<CartView>> {
  return runAction(addToCartSchema, input, async ({ variantId, quantity }) => {
    const owner = await addVariantToCart(variantId, quantity);
    return done(owner);
  });
}

export async function updateQuantity(input: unknown): Promise<ActionResult<CartView>> {
  return runAction(updateQuantitySchema, input, async ({ lineId, quantity }) => {
    const { owner, cartId } = await requireCart();
    const line = await prisma.cartItem.findFirst({
      where: { id: lineId, cartId },
      select: { id: true, variant: { select: { stock: true } } },
    });
    if (!line) throw new ActionError("That item is no longer in your cart.");

    const next = Math.min(quantity, maxLineQuantity(line.variant.stock));
    if (next <= 0) {
      if (quantity > 0) throw new ActionError("This item is out of stock. Remove it to continue.");
      await prisma.cartItem.delete({ where: { id: line.id } });
    } else {
      await prisma.cartItem.update({ where: { id: line.id }, data: { quantity: next } });
    }
    return done(owner);
  });
}

export type RemovedLine = { variantId: string; quantity: number };

/** Removes a line and returns what was removed, so the client can offer "Undo" (addToCart). */
export async function removeItem(input: unknown): Promise<ActionResult<{ cart: CartView; removed: RemovedLine | null }>> {
  return runAction(removeItemSchema, input, async ({ lineId }) => {
    const { owner, cartId } = await requireCart();
    const line = await prisma.cartItem.findFirst({
      where: { id: lineId, cartId },
      select: { id: true, variantId: true, quantity: true },
    });
    if (line) await prisma.cartItem.delete({ where: { id: line.id } });
    return { cart: await done(owner), removed: line ? { variantId: line.variantId, quantity: line.quantity } : null };
  });
}

export async function clearCart(input?: unknown): Promise<ActionResult<CartView>> {
  return runAction(emptySchema, input, async () => {
    const { owner, cartId } = await requireCart();
    await prisma.$transaction([
      prisma.cartItem.deleteMany({ where: { cartId } }),
      prisma.cart.update({ where: { id: cartId }, data: { couponId: null } }),
    ]);
    return done(owner);
  });
}

export async function applyCoupon(input: unknown): Promise<ActionResult<CartView>> {
  return runAction(couponSchema, input, async ({ code }) => {
    const { owner, cartId } = await requireCart();
    const coupon = await prisma.coupon.findUnique({ where: { code } });
    if (!coupon) throw new ActionError("Invalid coupon code");
    const unavailable = couponAvailabilityProblem(coupon);
    if (unavailable) throw new ActionError(unavailable);

    const cart = await getCart(owner);
    if (cart.lines.length === 0) throw new ActionError("Your cart is empty.");
    const minimum = couponMinimumProblem(coupon, cart.totals.subtotalCents);
    if (minimum) throw new ActionError(minimum);

    await prisma.cart.update({ where: { id: cartId }, data: { couponId: coupon.id } });
    return done(owner);
  });
}

export async function removeCoupon(input?: unknown): Promise<ActionResult<CartView>> {
  return runAction(emptySchema, input, async () => {
    const { owner, cartId } = await requireCart();
    await prisma.cart.update({ where: { id: cartId }, data: { couponId: null } });
    return done(owner);
  });
}
