import "server-only";
import { prisma } from "@/lib/db";

/**
 * Customer account reads (dashboard profile, stats, settings). Orders: lib/queries/orders.ts.
 * Per-user and request-time: never `"use cache"`. Callers resolve the user first
 * (requireUser()) and pass `userId` in, inside <Suspense>. Every query is scoped
 * by userId.
 */

export type AccountProfile = {
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
  emailVerified: boolean;
};

export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, image: true, role: true, emailVerified: true },
  });
}

/** A saved address as the forms edit it (strings; district may be legacy text). */
export type AccountAddress = {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  street: string;
  city: string;
  district: string;
  zip: string;
  email: string;
  phone: string;
};

/** The address the dashboard and Settings show: the default BILLING one. */
export async function getDefaultBillingAddress(userId: string): Promise<AccountAddress | null> {
  const row = await prisma.address.findFirst({
    where: { userId, kind: "BILLING" },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      street: true,
      city: true,
      district: true,
      zip: true,
      email: true,
      phone: true,
    },
  });
  return row ? { ...row, companyName: row.companyName ?? "" } : null;
}

/** Mobile profile screen: the quick-stats rail. */
export async function getAccountStats(userId: string): Promise<{ orders: number; wishlist: number; cart: number }> {
  const [orders, wishlist, cart] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.wishlist.count({ where: { userId, product: { status: "ACTIVE" } } }),
    prisma.cartItem.aggregate({ where: { cart: { userId } }, _sum: { quantity: true } }),
  ]);
  return { orders, wishlist, cart: cart._sum.quantity ?? 0 };
}
