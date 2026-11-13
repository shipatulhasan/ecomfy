import "server-only";
import { getCurrentUser } from "@/lib/auth-guards";
import type { CartView } from "@/lib/cart/pricing";
import { getCart } from "./cart";
import { getWishlistIds } from "./wishlist";

/**
 * Per-visitor storefront state (header cart, wishlist hearts + count, auth links).
 * Request-time and never cached: callers render inside <Suspense>.
 */
export type ShopUserState = {
  user: { name: string } | null;
  cart: CartView;
  wishlist: string[]; // product ids
};

export async function getShopUserState(): Promise<ShopUserState> {
  const user = await getCurrentUser();
  const [cart, wishlist] = await Promise.all([getCart(), getWishlistIds()]);
  return { user: user ? { name: user.name } : null, cart, wishlist };
}
