import { z } from "zod";
import { MAX_CART_QTY } from "@/lib/config/product";

// Product card "add to cart" (bag button), Quick View / PDP quantity stepper,
// wishlist "Add to Cart", and "Undo" after removing a cart line.
export const addToCartSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(MAX_CART_QTY).default(1),
});

// Cart page / mini cart quantity stepper. 0 removes the line.
export const updateQuantitySchema = z.object({
  lineId: z.string().min(1),
  quantity: z.number().int().min(0).max(MAX_CART_QTY),
});

// Cart page / mini cart ✕.
export const removeItemSchema = z.object({
  lineId: z.string().min(1),
});

// Shopping Cart "Coupon Code".
export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Enter a coupon code")
    .max(32, "That code is too long")
    .transform((s) => s.toUpperCase()),
});

export const emptySchema = z.object({}).optional();

export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateQuantityInput = z.infer<typeof updateQuantitySchema>;
export type CouponInput = z.input<typeof couponSchema>;
