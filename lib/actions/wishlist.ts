"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth-guards";
import { toggleWishlistSchema } from "@/lib/validations/wishlist";
import { ActionError, SIGN_IN_REQUIRED, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/** Add or remove a product from the signed-in user's wishlist. */
export async function toggleWishlist(input: unknown): Promise<ActionResult<{ wishlisted: boolean }>> {
  return runAction(toggleWishlistSchema, input, async ({ productId }) => {
    // Not requireUser(): a redirect from a client-invoked action would lose the click context.
    const user = await getCurrentUser();
    if (!user) throw new ActionError(SIGN_IN_REQUIRED);

    const key = { userId_productId: { userId: user.id, productId } };
    const existing = await prisma.wishlist.findUnique({ where: key, select: { productId: true } });
    if (existing) {
      await prisma.wishlist.delete({ where: key });
      return { wishlisted: false };
    }
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { status: true } });
    if (!product || product.status !== "ACTIVE") throw new ActionError("This product is no longer available.");
    await prisma.wishlist.create({ data: { userId: user.id, productId } });
    return { wishlisted: true };
  });
}
