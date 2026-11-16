import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { cronSecret } from "@/lib/env";
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
  const secret = cronSecret();
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok =
    secret !== null && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response("Unauthorized", { status: 401 });

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
