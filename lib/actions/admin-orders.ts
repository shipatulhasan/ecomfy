"use server";

import { refresh, updateTag } from "next/cache";
import { logAudit } from "@/lib/audit";
import { CacheTags } from "@/lib/cache-tags";
import { trackingUrlFor } from "@/lib/checkout/settings";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/money";
import {
  OrderTransitionError,
  STALE_MESSAGE,
  transitionOrder,
  transitionSelect,
  type TransitionOrder,
} from "@/lib/orders/admin-transition";
import { emailKindFor, queueOrderEmail, type OrderEmailKind } from "@/lib/orders/emails";
import { recordInternalNote } from "@/lib/orders/history";
import { getStoreSettings } from "@/lib/queries/settings";
import { consume } from "@/lib/rate-limit";
import {
  bulkStatusSchema,
  changeStatusSchema,
  internalNoteSchema,
  refundSchema,
  resendEmailSchema,
  updateShippingSchema,
  type AdminTarget,
} from "@/lib/validations/admin-order";
import { ActionError, type ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Admin → Order Management mutations. Each one:
 *   - re-checks the permission (runAdminAction: authorize, then validate);
 *   - re-reads the order and requires the `version` the admin loaded (stale → rejected);
 *   - goes through the transitions map (lib/orders/transitions.ts, via transitionOrder);
 *   - writes history + audit in the same transaction;
 *   - then expires the `orders` aggregates (updateTag: read-your-own-writes),
 *     refreshes the page and queues the customer email.
 */

const NOT_FOUND = "We couldn't find that order.";

function afterOrderChange(emails: { orderId: string; kind: OrderEmailKind | null }[] = []) {
  updateTag(CacheTags.orders);
  updateTag(CacheTags.payments);
  for (const e of emails) if (e.kind) queueOrderEmail(e.orderId, e.kind);
  refresh();
}

const findOrder = (number: number) => prisma.order.findUnique({ where: { number }, select: transitionSelect });

// ───────────────────────────── status ─────────────────────────────

export type StatusChangeResult = { number: number; status: AdminTarget; version: number };

/** Detail page / row menu: one status change. */
export async function changeOrderStatus(input: unknown): Promise<ActionResult<StatusChangeResult>> {
  return runAdminAction("orders:update", changeStatusSchema, input, async (data, actor) => {
    const [order, settings] = await Promise.all([findOrder(data.orderNumber), getStoreSettings()]);
    if (!order) throw new ActionError(NOT_FOUND);
    const shipment = data.courier && data.trackingNumber ? { courier: data.courier, trackingNumber: data.trackingNumber, trackingUrl: data.trackingUrl } : undefined;

    let email: OrderEmailKind | null;
    try {
      ({ email } = await prisma.$transaction((tx) =>
        transitionOrder(
          tx,
          order,
          { to: data.to, expectedVersion: data.version, actorId: actor.id, note: data.note, reason: data.reason, shipment },
          settings,
        ),
      ));
    } catch (err) {
      throw toActionError(err, order);
    }
    afterOrderChange([{ orderId: order.id, kind: email }]);
    return { number: order.number, status: data.to, version: order.version + 1 };
  });
}

export type BulkReport = { updated: number[]; skipped: { number: number; reason: string }[] };

/**
 * List bulk actions. Each order is its own transaction: an invalid or stale one is
 * skipped and reported ("3 updated, 1 skipped: order 1042 already delivered"), the
 * others still go through.
 */
export async function bulkChangeStatus(input: unknown): Promise<ActionResult<BulkReport>> {
  return runAdminAction("orders:update", bulkStatusSchema, input, async (data, actor) => {
    const settings = await getStoreSettings();
    const numbers = [...new Set(data.items.map((i) => i.orderNumber))];
    const orders = await prisma.order.findMany({ where: { number: { in: numbers } }, select: transitionSelect });
    const byNumber = new Map(orders.map((o) => [o.number, o]));

    const report: BulkReport = { updated: [], skipped: [] };
    const emails: { orderId: string; kind: OrderEmailKind | null }[] = [];
    const seen = new Set<number>();
    for (const item of data.items) {
      if (seen.has(item.orderNumber)) continue;
      seen.add(item.orderNumber);
      const order = byNumber.get(item.orderNumber);
      if (!order) {
        report.skipped.push({ number: item.orderNumber, reason: "not found" });
        continue;
      }
      const shipment =
        item.courier && item.trackingNumber ? { courier: item.courier, trackingNumber: item.trackingNumber, trackingUrl: item.trackingUrl } : undefined;
      try {
        const { email } = await prisma.$transaction((tx) =>
          transitionOrder(
            tx,
            order,
            { to: data.to, expectedVersion: item.version, actorId: actor.id, reason: data.reason, shipment },
            settings,
          ),
        );
        report.updated.push(order.number);
        emails.push({ orderId: order.id, kind: email });
      } catch (err) {
        if (!(err instanceof OrderTransitionError)) {
          console.error("[admin-orders] bulk", order.number, err);
          report.skipped.push({ number: order.number, reason: "failed, try again" });
        } else {
          report.skipped.push({ number: order.number, reason: err.reason });
        }
      }
    }
    if (report.updated.length) afterOrderChange(emails);
    return report;
  });
}

function toActionError(err: unknown, order: TransitionOrder): unknown {
  if (!(err instanceof OrderTransitionError)) return err;
  return new ActionError(err.stale ? STALE_MESSAGE : `Order #${order.number} ${err.reason}.`);
}

// ───────────────────────────── shipping ─────────────────────────────

/** Shipping card: courier + tracking, editable while PROCESSING / SHIPPED. */
export async function updateShipping(input: unknown): Promise<ActionResult<{ version: number }>> {
  return runAdminAction("orders:update", updateShippingSchema, input, async (data, actor) => {
    const [order, settings] = await Promise.all([
      prisma.order.findUnique({
        where: { number: data.orderNumber },
        select: { id: true, status: true, version: true, courier: true, trackingNumber: true, trackingUrl: true },
      }),
      getStoreSettings(),
    ]);
    if (!order) throw new ActionError(NOT_FOUND);
    if (order.status !== "PROCESSING" && order.status !== "SHIPPED") {
      throw new ActionError("Shipping details can only be changed while the order is processing or shipped.");
    }
    const trackingUrl = data.trackingUrl ?? trackingUrlFor(settings, data.courier, data.trackingNumber);

    await prisma.$transaction(async (tx) => {
      const n = await tx.order.updateMany({
        where: { id: order.id, version: data.version, status: { in: ["PROCESSING", "SHIPPED"] } },
        data: { courier: data.courier, trackingNumber: data.trackingNumber, trackingUrl, version: { increment: 1 } },
      });
      if (n.count !== 1) throw new ActionError(STALE_MESSAGE);
      await logAudit(
        {
          actorId: actor.id,
          action: "order.shipping",
          entity: "Order",
          entityId: order.id,
          before: { courier: order.courier, trackingNumber: order.trackingNumber, trackingUrl: order.trackingUrl },
          after: { courier: data.courier, trackingNumber: data.trackingNumber, trackingUrl },
        },
        tx,
      );
    });
    afterOrderChange();
    return { version: order.version + 1 };
  });
}

// ───────────────────────────── notes ─────────────────────────────

/** Timeline → "Add internal note" (staff only; never shown to the customer). */
export async function addInternalNote(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction("orders:update", internalNoteSchema, input, async (data, actor) => {
    const order = await prisma.order.findUnique({ where: { number: data.orderNumber }, select: { id: true } });
    if (!order) throw new ActionError(NOT_FOUND);
    const row = await prisma.$transaction(async (tx) => {
      const r = await recordInternalNote(tx, order.id, data.note, actor.id);
      await logAudit({ actorId: actor.id, action: "order.note", entity: "Order", entityId: order.id, after: { noteId: r.id } }, tx);
      return r;
    });
    refresh();
    return row;
  });
}

// ───────────────────────────── refunds ─────────────────────────────

/**
 * Payment card → "Mark as refunded": records a manual refund (no gateway refund API
 * yet). Partial refunds add up; the full amount sets paymentStatus REFUNDED.
 */
export async function recordRefund(input: unknown): Promise<ActionResult<{ refundedCents: number; version: number }>> {
  return runAdminAction("orders:refund", refundSchema, input, async (data, actor) => {
    const order = await prisma.order.findUnique({
      where: { number: data.orderNumber },
      select: {
        id: true,
        version: true,
        paymentStatus: true,
        totalCents: true,
        refundedCents: true,
        orderNumber: true,
        userId: true,
        paymentMethod: true,
        currency: true,
      },
    });
    if (!order) throw new ActionError(NOT_FOUND);
    if (order.paymentStatus !== "PAID") throw new ActionError("Only paid orders can be refunded.");
    const amountCents = Math.round(data.amount * 100);
    const left = order.totalCents - order.refundedCents;
    if (amountCents > left) {
      throw new ActionError("Please fix the highlighted fields.", { amount: [`At most ${formatPrice(left)} is left to refund`] });
    }
    const refundedCents = order.refundedCents + amountCents;
    const full = refundedCents >= order.totalCents;

    await prisma.$transaction(async (tx) => {
      const n = await tx.order.updateMany({
        where: { id: order.id, version: data.version, paymentStatus: "PAID", refundedCents: order.refundedCents },
        data: { refundedCents, version: { increment: 1 }, ...(full && { paymentStatus: "REFUNDED" }) },
      });
      if (n.count !== 1) throw new ActionError(STALE_MESSAGE);
      // Ledger row (admin Transactions): a REFUND with a negative amount.
      const refundNo = (await tx.refund.count({ where: { orderId: order.id } })) + 1;
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          userId: order.userId,
          type: "REFUND",
          method: order.paymentMethod,
          reference: `${order.orderNumber}-R${refundNo}`,
          amountCents: -amountCents,
          currency: order.currency,
          status: "SUCCEEDED",
          completedAt: new Date(),
        },
        select: { id: true },
      });
      const refund = await tx.refund.create({
        data: { orderId: order.id, amountCents, note: data.note, actorId: actor.id, paymentId: payment.id },
        select: { id: true },
      });
      if (full) {
        await tx.payment.updateMany({
          where: { orderId: order.id, type: { not: "REFUND" }, status: "SUCCEEDED" },
          data: { status: "REFUNDED" },
        });
      }
      await recordInternalNote(tx, order.id, `Refunded ${formatPrice(amountCents)}${full ? " (full)" : ""}: ${data.note}`, actor.id);
      await logAudit(
        {
          actorId: actor.id,
          action: "order.refund",
          entity: "Order",
          entityId: order.id,
          before: { paymentStatus: order.paymentStatus, refundedCents: order.refundedCents },
          after: { paymentStatus: full ? "REFUNDED" : "PAID", refundedCents, refundId: refund.id, paymentId: payment.id, amountCents },
        },
        tx,
      );
    });
    afterOrderChange();
    return { refundedCents, version: order.version + 1 };
  });
}

// ───────────────────────────── email ─────────────────────────────

/** Actions card → "Resend email": the email for the order's current status. */
export async function resendOrderEmail(input: unknown): Promise<ActionResult<{ kind: OrderEmailKind }>> {
  return runAdminAction("orders:update", resendEmailSchema, input, async (data, actor) => {
    const order = await prisma.order.findUnique({ where: { number: data.orderNumber }, select: { id: true, status: true } });
    if (!order) throw new ActionError(NOT_FOUND);
    const kind = emailKindFor(order.status);
    if (!kind) throw new ActionError("There's no customer email for this status.");
    const limit = await consume(`order-email:${order.id}`, { window: 10 * 60, max: 3 });
    if (!limit.allowed) throw new ActionError("This email was just sent. Try again in a few minutes.");
    await logAudit({ actorId: actor.id, action: "order.email.resend", entity: "Order", entityId: order.id, after: { kind } });
    queueOrderEmail(order.id, kind);
    return { kind };
  });
}
