import "server-only";
import { revalidateTag } from "next/cache";
import { CacheTags } from "@/lib/cache-tags";

/**
 * Order / payment state changed: expire the admin's cached order aggregates
 * (dashboard, sidebar badge) and payment aggregates (Transactions KPIs, the
 * "needs attention" badge). Runs from server actions and from route handlers
 * (gateway callbacks, cron), so it uses revalidateTag(tag, "max"). Admin order
 * actions should call updateTag(CacheTags.orders) + updateTag(CacheTags.payments) instead (read-your-own-writes).
 */
export function invalidateOrderAggregates() {
  try {
    revalidateTag(CacheTags.orders, "max");
    revalidateTag(CacheTags.payments, "max");
  } catch (err) {
    // Outside a Next request scope (scripts): nothing cached to expire.
    console.warn("[orders] cache invalidation skipped", err instanceof Error ? err.message : err);
  }
}
