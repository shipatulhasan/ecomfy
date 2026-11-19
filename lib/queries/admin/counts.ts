import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import type { AdminBadgeKey } from "@/lib/admin/nav";
import { attentionRows } from "@/lib/payments/attention";

/**
 * Sidebar badges + topbar bell. Order mutations expire the `orders` tag
 * (lib/orders/cache.ts); otherwise refreshed every few minutes.
 * Callers have already checked the session (AdminShell → requireStaff()).
 */
export type AdminCounts = Record<Exclude<AdminBadgeKey, "paymentsAttention">, number> & {
  codToConfirm: number;
  awaitingPayment: number;
};

export async function getAdminBadgeCounts(): Promise<AdminCounts> {
  "use cache";
  cacheTag(CacheTags.orders);
  cacheLife("minutes");

  const rows = await prisma.order.groupBy({
    by: ["status"],
    where: { status: { in: ["PENDING_CONFIRMATION", "PENDING_PAYMENT"] } },
    _count: { _all: true },
  });
  const n = (s: string) => rows.find((r) => r.status === s)?._count._all ?? 0;
  const codToConfirm = n("PENDING_CONFIRMATION");
  const awaitingPayment = n("PENDING_PAYMENT");
  return { pendingOrders: codToConfirm + awaitingPayment, codToConfirm, awaitingPayment };
}

/**
 * Transaction menu badge: payments that need attention (lib/payments/attention.ts).
 * Only call it for users with `payments:read`. Payment writes expire `payments`;
 * the "pending > 30 min" rule is time-based, so it also refreshes every few minutes.
 */
export async function getPaymentsAttentionCount(): Promise<number> {
  "use cache";
  cacheTag(CacheTags.payments);
  cacheLife("minutes");
  return (await attentionRows()).size;
}
