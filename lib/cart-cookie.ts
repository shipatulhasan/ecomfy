import "server-only";
import { cookies } from "next/headers";

/** Guest carts (signed-out visitors) are found by a random token in this httpOnly cookie. */
export const CART_COOKIE = "ecomfy_cart";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function readGuestCartToken(): Promise<string | null> {
  return (await cookies()).get(CART_COOKIE)?.value ?? null;
}

/** Only callable from a Server Action or Route Handler (cookies can't be set while rendering). */
export async function writeGuestCartToken(token: string) {
  (await cookies()).set(CART_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}
