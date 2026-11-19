"use server";

import { refresh, updateTag } from "next/cache";
import { logAudit } from "@/lib/audit";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { attentionRows } from "@/lib/payments/attention";
import { reconcilePayment } from "@/lib/payments/reconcile";
import { consume } from "@/lib/rate-limit";
import { verifyPaymentSchema } from "@/lib/validations/admin-payment";
import { ActionError, type ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Admin → Transactions. The page is read-only except this reconciliation (and the
 * CSV export route). The action re-checks `payments:reconcile`, asks the gateway,
 * settles the row (and its order, via the transitions map) through the payment
 * state machine and audits before / after.
 */

export type VerifyResult = { changed: boolean; gatewayState: string; message: string };

export async function verifyPaymentWithGateway(input: unknown): Promise<ActionResult<VerifyResult>> {
  return runAdminAction("payments:reconcile", verifyPaymentSchema, input, async ({ id }, actor) => {
    const p = await prisma.payment.findUnique({ where: { id }, select: { id: true, status: true, type: true, method: true } });
    if (!p) throw new ActionError("We couldn't find that transaction.");
    if (p.type !== "CHARGE" || p.method === "COD") throw new ActionError("Only online charges can be checked with a gateway.");
    const open = p.status === "INITIATED" || p.status === "PENDING";
    if (!open && !(await attentionRows([p.id])).size) {
      throw new ActionError("This transaction is settled and nothing looks wrong with it.");
    }
    const limit = await consume(`payment-verify:${p.id}`, { window: 60, max: 3 });
    if (!limit.allowed) throw new ActionError("This transaction was just checked. Try again in a minute.");

    const r = await reconcilePayment(p.id, "[reconcile-admin]");
    await logAudit({
      actorId: actor.id,
      action: "payment.reconcile",
      entity: "Payment",
      entityId: p.id,
      before: r.before,
      after: { ...r.after, gateway: { state: r.gatewayState, status: r.gatewayStatus }, changed: r.changed },
    });
    if (r.changed) {
      updateTag(CacheTags.payments);
      updateTag(CacheTags.orders);
    }
    refresh();
    return { changed: r.changed, gatewayState: r.gatewayState, message: r.message };
  });
}
