import "server-only";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth-guards";
import { MAX_COOKIE_ORDERS, ORDERS_COOKIE } from "@/lib/config/checkout";

/**
 * Who may see an order's success / failed page and retry its payment: its
 * signed-in owner, or the browser that placed it (guest orders: ids in an
 * httpOnly cookie). Order ids are unguessable cuids, never order numbers.
 */
async function cookieOrderIds(): Promise<string[]> {
  const raw = (await cookies()).get(ORDERS_COOKIE)?.value ?? "";
  return raw.split(".").filter((s) => /^[a-z0-9]{20,40}$/.test(s));
}

/** Only from a Server Action / Route Handler. */
export async function rememberOrder(orderId: string) {
  const ids = [orderId, ...(await cookieOrderIds()).filter((id) => id !== orderId)].slice(0, MAX_COOKIE_ORDERS);
  (await cookies()).set(ORDERS_COOKIE, ids.join("."), {
    httpOnly: true,
    sameSite: "lax", // sent on the top-level GET back from the gateway
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function canAccessOrder(order: { id: string; userId: string | null }): Promise<boolean> {
  if (order.userId) {
    const user = await getCurrentUser();
    if (user?.id === order.userId) return true;
  }
  return (await cookieOrderIds()).includes(order.id);
}
