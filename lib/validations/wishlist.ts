import { z } from "zod";

// Product card heart / PDP wishlist button / Wishlist "Undo".
export const toggleWishlistSchema = z.object({
  productId: z.string().min(1),
});

// Wishlist ✕.
export const removeFromWishlistSchema = toggleWishlistSchema;

// Wishlist "Add to Cart" (variant chosen in the picker for multi-option products).
export const moveToCartSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
});

export type ToggleWishlistInput = z.infer<typeof toggleWishlistSchema>;
export type MoveToCartInput = z.infer<typeof moveToCartSchema>;
