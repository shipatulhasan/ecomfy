import { revalidateTag } from "next/cache";
import { connection } from "next/server";
import { logAudit } from "@/lib/audit";
import { CacheTags } from "@/lib/cache-tags";
import { authorizeCron } from "@/lib/cron";
import { reconcileStuck } from "@/lib/payments/reconcile";

/**
 * Payment reconciliation: online attempts stuck INITIATED / PENDING for more than
 * 10 minutes are checked with their gateway (bKash Query, SSLCommerz Transaction
 * Query) and settled through the payment state machine, so a missed callback never
 * leaves a paid order unpaid. Every change is audited (actor: system).
 * Scheduled by vercel.json (every 15 min); call with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: Request) {
  await connection();
  if (!authorizeCron(request)) return new Response("Unauthorized", { status: 401 });

  const { checked, results } = await reconcileStuck({ olderThanMin: 10, limit: 100 });
  const changed = results.filter((r) => r.changed);
  for (const r of changed) {
    await logAudit({
      actorId: null,
      action: "payment.reconcile.auto",
      entity: "Payment",
      entityId: r.id,
      before: r.before,
      after: { ...r.after, gateway: { state: r.gatewayState, status: r.gatewayStatus } },
    });
  }
  if (changed.length) {
    revalidateTag(CacheTags.payments, "max");
    revalidateTag(CacheTags.orders, "max");
  }
  return Response.json({
    checked,
    changed: changed.length,
    results: results.map((r) => ({ id: r.id, gateway: r.gatewayState, status: r.gatewayStatus, changed: r.changed })),
  });
}
