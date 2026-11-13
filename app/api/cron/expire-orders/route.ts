import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { cronSecret } from "@/lib/env";
import { expireStale } from "@/lib/payments/state";
import { pruneRateLimits } from "@/lib/rate-limit";

/**
 * PENDING_PAYMENT orders unpaid after 30 minutes → EXPIRED, stock released.
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
  return Response.json({ expired });
}
