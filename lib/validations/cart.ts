import { z } from "zod";
import { MAX_CART_QTY } from "@/lib/config/product";

// Product card "add to cart" (bag button), Quick View / PDP quantity stepper.
export const addToCartSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_CART_QTY).default(1),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>;
