import "server-only";
import { prisma } from "@/lib/db";
import { ActionError } from "@/lib/actions/result";
import { getOrCreateCart, type CartOwner } from "./owner";
import { availableStock, maxLineQuantity } from "./pricing";

/**
 * Add `quantity` of a variant to the visitor's cart, capped at stock. Shared by
 * the cart actions and the wishlist "Add to Cart". Throws ActionError with a
 * shopper-facing message when nothing can be added.
 */
export async function addVariantToCart(variantId: string, quantity: number): Promise<CartOwner> {
  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { stock: true, reserved: true, product: { select: { status: true } } },
  });
  if (!variant || variant.product.status !== "ACTIVE") {
    throw new ActionError("This product is no longer available.");
  }
  const cap = maxLineQuantity(availableStock(variant));
  if (cap <= 0) throw new ActionError("Sorry, this product is out of stock.");

  const { cartId, owner } = await getOrCreateCart();
  const key = { cartId_variantId: { cartId, variantId } };
  const line = await prisma.cartItem.findUnique({ where: key, select: { quantity: true } });
  const current = line?.quantity ?? 0;
  if (current >= cap) {
    throw new ActionError(`Only ${cap} available, and they're all in your cart.`);
  }
  const next = Math.min(cap, current + quantity);
  await prisma.cartItem.upsert({
    where: key,
    create: { cartId, variantId, quantity: next },
    update: { quantity: next },
  });
  return owner;
}
