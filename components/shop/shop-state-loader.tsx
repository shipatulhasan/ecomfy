import { getShopUserState } from "@/lib/queries/user-state";
import { ShopStateHydrator } from "./shop-state";

/**
 * Reads the session, cart and wishlist at request time and hands them to the
 * client store. Must render inside <Suspense> (it reads cookies/headers).
 */
export async function ShopStateLoader() {
  const state = await getShopUserState();
  return <ShopStateHydrator state={state} />;
}
