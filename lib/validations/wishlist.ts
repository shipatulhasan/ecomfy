import { z } from "zod";

// Product card heart / PDP wishlist button.
export const toggleWishlistSchema = z.object({
  productId: z.string().min(1),
});

export type ToggleWishlistInput = z.infer<typeof toggleWishlistSchema>;
