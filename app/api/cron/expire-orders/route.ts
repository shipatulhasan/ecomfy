import { connection } from "next/server";
import { authorizeCron } from "@/lib/cron";
import { getStoreSettings } from "@/lib/queries/settings";
import { reconcileStuck } from "@/lib/payments/reconcile";
import { expireStale } from "@/lib/payments/state";
import { pruneRateLimits } from "@/lib/rate-limit";
import { revalidateTag } from "next/cache";
import { syncScheduledPrices } from "@/lib/admin/products/schedule";
import { CacheTags } from "@/lib/cache-tags";

/**
 * PENDING_PAYMENT orders unpaid after 30 minutes → EXPIRED, stock released.
 * Also opens/closes product sale windows (Add Product "Expiration").
 * Scheduled by vercel.json (every 5 min); call with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  await connection(); // request-time only, never prerendered
  if (!authorizeCron(request)) return new Response("Unauthorized", { status: 401 });

  // Ask the gateway before expiring: a payment whose callback never arrived is paid, not expired.
  await reconcileStuck({ olderThanMin: (await getStoreSettings()).pendingPaymentTtlMin, limit: 50 }).catch((e) => console.error("[cron] pre-expiry reconcile", e));
  const expired = await expireStale({ limit: 500 });
  await pruneRateLimits().catch(() => {});
  const prices = await syncScheduledPrices().catch((e) => {
    console.error("[cron] sale windows", e);
    return { slugs: [], categorySlugs: [] };
  });
  if (prices.slugs.length > 0) {
    revalidateTag(CacheTags.products, "max");
    for (const s of prices.slugs) revalidateTag(CacheTags.product(s), "max");
    for (const c of prices.categorySlugs) revalidateTag(CacheTags.productsInCategory(c), "max");
  }
  return Response.json({ expired, salePrices: prices.slugs.length });
}
