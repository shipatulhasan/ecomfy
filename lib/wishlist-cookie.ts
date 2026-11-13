import "server-only";
import { cookies } from "next/headers";
import { MAX_GUEST_WISHLIST } from "@/lib/config/cart";

/**
 * Signed-out visitors keep their wishlist in this httpOnly cookie as a JSON array
 * of product ids. It merges into the account on sign-in (lib/cart/merge.ts).
 * The ids are untrusted: readers check them against the DB.
 */
export const WISHLIST_COOKIE = "ecomfy_wishlist";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export function parseWishlistCookie(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const ids = value.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 64);
    return [...new Set(ids)].slice(0, MAX_GUEST_WISHLIST);
  } catch {
    return [];
  }
}

export async function readGuestWishlist(): Promise<string[]> {
  return parseWishlistCookie((await cookies()).get(WISHLIST_COOKIE)?.value);
}

/** Only callable from a Server Action or Route Handler. Newest first. */
export async function writeGuestWishlist(ids: string[]) {
  const store = await cookies();
  if (ids.length === 0) {
    store.delete(WISHLIST_COOKIE);
    return;
  }
  store.set(WISHLIST_COOKIE, JSON.stringify(ids.slice(0, MAX_GUEST_WISHLIST)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}
