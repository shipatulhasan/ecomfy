import "server-only";
import { prisma } from "@/lib/db";
import { getStoreSettings } from "@/lib/queries/settings";
import { bkashGatewayAnswer } from "./bkash";
import { paymentLog, paymentWarn, redact } from "./log";
import { sslczGatewayAnswer } from "./sslcommerz";
import { appendPaymentLog, markFailed, markPaid } from "./state";
import type { GatewayAnswer } from "./types";

/**
 * Ask the gateway about one attempt and bring our state in line with it. Used by
 * the admin "Verify with gateway" action and the reconciliation cron, so a missed
 * callback never leaves a paid order unpaid.
 *
 * Goes through the same state machine as the callbacks (markPaid / markFailed),
 * so the order follows lib/orders/transitions.ts (canTransition, version bump,
 * stock, history, email). A SUCCEEDED row is never downgraded here: if the gateway
 * disagrees, it's reported as a discrepancy for a human to look at.
 */

export type PaymentSnapshot = {
  status: string;
  order: { status: string; paymentStatus: string; version: number };
};

export type ReconcileResult = {
  changed: boolean;
  /** "paid" | "failed" | "pending" | "unknown" | "unsupported" | "error" */
  gatewayState: string;
  gatewayStatus: string;
  message: string;
  before: PaymentSnapshot;
  after: PaymentSnapshot;
};

const OPEN = new Set(["INITIATED", "PENDING"]);

async function snapshot(id: string): Promise<PaymentSnapshot> {
  const p = await prisma.payment.findUniqueOrThrow({
    where: { id },
    select: { status: true, order: { select: { status: true, paymentStatus: true, version: true } } },
  });
  return { status: p.status, order: p.order };
}

export async function reconcilePayment(id: string, tag = "[reconcile]"): Promise<ReconcileResult> {
  const p = await prisma.payment.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      method: true,
      status: true,
      reference: true,
      paymentId: true,
      amountCents: true,
      currency: true,
      createdAt: true,
    },
  });
  if (!p) throw new Error("Unknown payment");
  const before = await snapshot(id);
  const done = (gatewayState: string, gatewayStatus: string, message: string, after: PaymentSnapshot = before) => ({
    changed: after.status !== before.status || after.order.status !== before.order.status || after.order.paymentStatus !== before.order.paymentStatus,
    gatewayState,
    gatewayStatus,
    message,
    before,
    after,
  });

  if (p.type !== "CHARGE" || p.method === "COD") {
    return done("unsupported", "", "Only online charges can be checked with a gateway.");
  }

  let answer: GatewayAnswer;
  try {
    if (p.method === "BKASH") {
      // No paymentID: the bKash checkout was never created, so there's nothing to pay.
      if (!p.paymentId) {
        answer = { state: "pending", abandoned: true, status: "not created", amountCents: null, currency: null, reference: null, ids: {}, response: {} };
      } else {
        answer = await bkashGatewayAnswer(p.paymentId);
      }
    } else {
      answer = await sslczGatewayAnswer(p.reference);
    }
  } catch (err) {
    await appendPaymentLog(p.id, paymentWarn(tag, "query-error", { error: String(err) }));
    return done("error", "", `The gateway didn't answer: ${err instanceof Error ? err.message : String(err)}`);
  }

  const log = [paymentLog(tag, "query", { state: answer.state, status: answer.status, response: redact(answer.response) })];
  const open = OPEN.has(p.status);
  const ageMin = (Date.now() - p.createdAt.getTime()) / 60_000;

  if (answer.state === "paid") {
    const matches =
      answer.amountCents === p.amountCents &&
      (answer.currency ?? "BDT") === p.currency &&
      (!answer.reference || answer.reference === p.reference);
    if (!matches) {
      log.push(paymentWarn(tag, "mismatch", { amount: answer.amountCents, expected: p.amountCents, reference: answer.reference, currency: answer.currency }));
      await appendPaymentLog(p.id, ...log);
      return done("paid", answer.status, "The gateway reports a payment, but the amount or reference doesn't match. Review it before changing anything.");
    }
    if (p.status === "SUCCEEDED" || p.status === "REFUNDED") {
      await appendPaymentLog(p.id, ...log);
      return done("paid", answer.status, "The gateway agrees: this payment is complete.");
    }
    await markPaid(p.reference, answer.ids, tag, log);
    const after = await snapshot(id);
    return done("paid", answer.status, "The gateway confirmed the payment. The transaction and its order are updated.", after);
  }

  if (answer.state === "failed" || (answer.state === "pending" && answer.abandoned && ageMin > (await getStoreSettings()).pendingPaymentTtlMin)) {
    if (p.status === "SUCCEEDED" || p.status === "REFUNDED") {
      log.push(paymentWarn(tag, "gateway-disagrees", { ours: p.status, gateway: answer.status, action: "review" }));
      await appendPaymentLog(p.id, ...log);
      return done(answer.state, answer.status, "We have this as paid, but the gateway doesn't. Review it before changing anything.");
    }
    if (!open) {
      await appendPaymentLog(p.id, ...log);
      return done(answer.state, answer.status, "The gateway agrees: this payment didn't go through.");
    }
    await markFailed(p.reference, "failed", answer.state === "failed" ? `Gateway: ${answer.status}` : "Not completed at the gateway", tag, log);
    const after = await snapshot(id);
    return done("failed", answer.status, "The gateway says this payment didn't go through. The transaction is marked failed.", after);
  }

  await appendPaymentLog(p.id, ...log);
  return done(
    answer.state,
    answer.status,
    answer.state === "pending" ? "The gateway still has this payment in progress. Nothing changed." : "The gateway couldn't say. Nothing changed.",
  );
}

/**
 * Cron: online attempts still INITIATED / PENDING after `olderThanMin` minutes.
 * Sequential (gateways rate-limit), at most `limit` per run.
 */
export async function reconcileStuck(opts: { olderThanMin?: number; limit?: number } = {}) {
  const stuck = await prisma.payment.findMany({
    where: {
      type: "CHARGE",
      method: { not: "COD" },
      status: { in: ["INITIATED", "PENDING"] },
      createdAt: { lt: new Date(Date.now() - (opts.olderThanMin ?? 10) * 60_000) },
    },
    orderBy: { createdAt: "asc" },
    take: opts.limit ?? 100,
    select: { id: true },
  });
  const results: (ReconcileResult & { id: string })[] = [];
  for (const { id } of stuck) {
    try {
      results.push({ id, ...(await reconcilePayment(id, "[reconcile-cron]")) });
    } catch (err) {
      console.warn("[reconcile-cron] failed", id, String(err));
    }
  }
  return { checked: stuck.length, results };
}
