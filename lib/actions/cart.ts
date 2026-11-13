"use server";

import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-guards";
import { readGuestCartToken, writeGuestCartToken } from "@/lib/cart-cookie";
import { getCartSummary, type CartSummary } from "@/lib/queries/user-state";
import { addToCartSchema } from "@/lib/validations/cart";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Add a variant to the visitor's cart and return the new header summary.
 *
 * Auth: public by design — signed-out visitors get a guest cart (httpOnly cookie
 * token, `Cart.guestToken`). The session is still resolved here, never trusted
 * from the client: a signed-in user always writes to their own cart.
 */
export async function addToCart(input: unknown): Promise<ActionResult<CartSummary>> {
  return runAction(addToCartSchema, input, async ({ variantId, quantity }) => {
    const variant = await prisma.variant.findUnique({
      where: { id: variantId },
      select: { id: true, stock: true, product: { select: { status: true } } },
    });
    if (!variant || variant.product.status !== "ACTIVE") {
      throw new ActionError("This product is no longer available.");
    }
    if (variant.stock <= 0) throw new ActionError("Sorry, this product is out of stock.");

    const user = await getCurrentUser();
    let cartId: string;
    let owner: { userId: string } | { guestToken: string };
    if (user) {
      const cart = await prisma.cart.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
        select: { id: true },
      });
      cartId = cart.id;
      owner = { userId: user.id };
    } else {
      const existing = await readGuestCartToken();
      const cart = existing
        ? await prisma.cart.findUnique({ where: { guestToken: existing }, select: { id: true } })
        : null;
      if (cart && existing) {
        cartId = cart.id;
        owner = { guestToken: existing };
      } else {
        const guestToken = randomUUID();
        cartId = (await prisma.cart.create({ data: { guestToken }, select: { id: true } })).id;
        await writeGuestCartToken(guestToken);
        owner = { guestToken };
      }
    }

    const line = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId, variantId } },
      select: { quantity: true },
    });
    const next = Math.min(variant.stock, (line?.quantity ?? 0) + quantity);
    await prisma.cartItem.upsert({
      where: { cartId_variantId: { cartId, variantId } },
      create: { cartId, variantId, quantity: next },
      update: { quantity: next },
    });

    return getCartSummary(owner);
  });
}
