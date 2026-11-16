"use server";

import { can } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { limitAuthAttempt } from "@/lib/rate-limit";
import { adminSearchSchema } from "@/lib/validations/admin";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Topbar search / Cmd+K palette. Each group is only searched when the signed-in
 * staff member may read it (orders:read, products:read, customers:read).
 */
export type AdminSearchHit = { id: string; label: string; detail: string; href: string };
export type AdminSearchResult = { orders: AdminSearchHit[]; products: AdminSearchHit[]; customers: AdminSearchHit[] };

const TAKE = 5;

export async function adminSearchAction(input: unknown): Promise<ActionResult<AdminSearchResult>> {
  return runAction(adminSearchSchema, input, async ({ q }) => {
    const user = await requireStaff();
    const limited = await limitAuthAttempt("admin-search", user.id);
    if (limited) throw new ActionError(limited);

    const contains = { contains: q, mode: "insensitive" as const };
    // Order number typed as "4152", with a leading hash, or as "ECF-004152".
    const digits = q.replace(/^#/, "").replace(/^ECF-?/i, "");
    const number = /^\d{1,9}$/.test(digits) ? Number(digits) : null;

    const [orders, products, customers] = await Promise.all([
      can(user, "orders:read")
        ? prisma.order.findMany({
            where: { OR: [...(number !== null ? [{ number }] : []), { orderNumber: contains }, { email: contains }, { phone: contains }] },
            orderBy: { createdAt: "desc" },
            take: TAKE,
            select: { number: true, orderNumber: true, email: true, totalCents: true },
          })
        : [],
      can(user, "products:read")
        ? prisma.product.findMany({
            where: { OR: [{ name: contains }, { sku: contains }] },
            orderBy: { name: "asc" },
            take: TAKE,
            select: { id: true, name: true, sku: true },
          })
        : [],
      can(user, "customers:read")
        ? prisma.user.findMany({
            where: { role: "CUSTOMER", OR: [{ name: contains }, { email: contains }, { phone: contains }] },
            orderBy: { createdAt: "desc" },
            take: TAKE,
            select: { id: true, name: true, email: true },
          })
        : [],
    ]);

    return {
      orders: orders.map((o) => ({
        id: o.orderNumber,
        label: `Order #${o.number}`,
        detail: `${o.orderNumber} · ${o.email}`,
        href: `/admin/orders/${o.number}`,
      })),
      products: products.map((p) => ({ id: p.id, label: p.name, detail: `#${p.sku}`, href: `/admin/products/${p.id}` })),
      customers: customers.map((c) => ({ id: c.id, label: c.name, detail: c.email, href: `/admin/customers/${c.id}` })),
    };
  });
}
