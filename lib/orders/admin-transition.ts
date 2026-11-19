import "server-only";
import { logAudit } from "@/lib/audit";
import { trackingUrlFor, type StoreSettings } from "@/lib/checkout/settings";
import { paymentReference } from "@/lib/config/checkout";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrderStatus, PaymentMethod, PaymentStatus, StockState } from "@/lib/generated/prisma/enums";
import { recordStatus } from "@/lib/orders/history";
import { canTransition, transitionBlockReason } from "@/lib/orders/transitions";
import { commitStock, returnStock } from "@/lib/payments/state";
import { emailKindFor, type OrderEmailKind } from "./emails";

/**
 * One admin status change, inside the caller's transaction:
 *   1. the transitions map (lib/orders/transitions.ts) must allow it;
 *   2. a conditional update on (id, version, status) claims the row, so a stale
 *      tab or a concurrent change (customer, gateway, another admin) fails;
 *   3. side effects in the same transaction: stock, COD cash, payment attempts;
 *   4. OrderStatusHistory (with the staff member) + AuditLog.
 * The caller expires caches and queues the email after the commit.
 */

type Tx = Prisma.TransactionClient;

/** `reason` is short and unprefixed ("already delivered"), for the bulk report. */
export class OrderTransitionError extends Error {
  constructor(
    public readonly reason: string,
    public readonly stale = false,
  ) {
    super(reason);
    this.name = "OrderTransitionError";
  }
}

export const STALE_MESSAGE = "This order changed since you opened it. Reload to see the latest.";
export const STALE_REASON = "changed meanwhile (reload and try again)";

/** The order fields a transition needs (select with `transitionSelect`). */
export const transitionSelect = {
  id: true,
  number: true,
  orderNumber: true,
  status: true,
  version: true,
  paymentMethod: true,
  paymentStatus: true,
  stockState: true,
  deliveredAt: true,
  courier: true,
  trackingNumber: true,
  userId: true,
  totalCents: true,
  currency: true,
} satisfies Prisma.OrderSelect;

export type TransitionOrder = {
  id: string;
  number: number;
  orderNumber: string;
  status: OrderStatus;
  version: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  stockState: StockState;
  deliveredAt: Date | null;
  courier: string | null;
  trackingNumber: string | null;
  userId: string | null;
  totalCents: number;
  currency: string;
};

export type TransitionInput = {
  to: OrderStatus;
  /** The version the admin loaded. */
  expectedVersion: number;
  actorId: string;
  note?: string;
  reason?: string;
  shipment?: { courier: string; trackingNumber: string; trackingUrl?: string };
};

export async function transitionOrder(
  tx: Tx,
  order: TransitionOrder,
  input: TransitionInput,
  settings: Pick<StoreSettings, "returnWindowDays" | "courierTrackingUrls">,
): Promise<{ email: OrderEmailKind | null }> {
  const { to } = input;
  if (order.version !== input.expectedVersion) throw new OrderTransitionError(STALE_REASON, true);
  const ctx = { actor: "admin" as const, deliveredAt: order.deliveredAt, returnWindowDays: settings.returnWindowDays };
  if (!canTransition(order.status, to, ctx)) {
    throw new OrderTransitionError(transitionBlockReason(order.status, to, ctx));
  }

  const now = new Date();
  const data: Prisma.OrderUpdateManyMutationInput = { status: to, version: { increment: 1 } };
  let note = input.note ?? null;
  const cashCollected = to === "DELIVERED" && order.paymentMethod === "COD" && order.paymentStatus === "UNPAID";

  switch (to) {
    case "PROCESSING":
      note ??= order.paymentMethod === "COD" ? "Order confirmed" : null;
      break;
    case "SHIPPED": {
      const s = input.shipment;
      if (!s) throw new OrderTransitionError("needs a courier and tracking number");
      const trackingUrl = s.trackingUrl ?? trackingUrlFor(settings, s.courier, s.trackingNumber);
      Object.assign(data, { courier: s.courier, trackingNumber: s.trackingNumber, trackingUrl, shippedAt: now });
      note ??= `Shipped with ${s.courier} · ${s.trackingNumber}`;
      break;
    }
    case "DELIVERED":
      data.deliveredAt = now;
      if (cashCollected) Object.assign(data, { paymentStatus: "PAID", paidAt: now });
      note ??= cashCollected ? "Delivered · cash collected" : "Delivered";
      break;
    case "CANCELLED":
      Object.assign(data, { cancelledAt: now, cancelReason: input.reason ?? null, expiresAt: null });
      note = [input.reason, input.note].filter(Boolean).join(" · ") || "Cancelled by staff";
      break;
    case "RETURNED":
      note ??= "Returned";
      break;
  }

  const claimed = await tx.order.updateMany({
    where: { id: order.id, version: input.expectedVersion, status: order.status },
    data,
  });
  if (claimed.count !== 1) throw new OrderTransitionError(STALE_REASON, true);

  // ── side effects (same transaction) ──
  if (to === "SHIPPED") {
    // COD keeps its reservation until it ships: now the units physically leave.
    await commitStock(tx, order.id, "[admin]");
  }
  if (to === "DELIVERED" && order.paymentMethod === "COD") {
    const collected = await tx.payment.updateMany({
      where: { orderId: order.id, method: "COD", type: "COD_COLLECTION", status: { in: ["INITIATED", "PENDING"] } },
      data: { status: "SUCCEEDED", completedAt: now },
    });
    // Older orders (or a superseded row) may have no open COD row: the cash still goes in the ledger.
    if (collected.count === 0 && cashCollected) await recordCodCollection(tx, order, now);
  }
  if (to === "CANCELLED" || to === "RETURNED") {
    await returnStock(tx, order.id);
    await tx.payment.updateMany({
      where: { orderId: order.id, type: { not: "REFUND" }, status: { in: ["INITIATED", "PENDING"] } },
      data: { status: "CANCELLED", failReason: "Order cancelled by staff", completedAt: now },
    });
  }

  await recordStatus(tx, order.id, to, note, "admin", input.actorId);
  await logAudit(
    {
      actorId: input.actorId,
      action: "order.status",
      entity: "Order",
      entityId: order.id,
      before: { status: order.status, paymentStatus: order.paymentStatus, version: order.version },
      after: {
        status: to,
        version: order.version + 1,
        ...(cashCollected && { paymentStatus: "PAID" }),
        ...(input.shipment && { courier: input.shipment.courier, trackingNumber: input.shipment.trackingNumber }),
        ...(input.reason && { reason: input.reason }),
      },
    },
    tx,
  );

  return { email: emailKindFor(to) };
}

/** A SUCCEEDED COD_COLLECTION row for cash taken on delivery (next attempt number). */
async function recordCodCollection(tx: Tx, order: TransitionOrder, at: Date) {
  const last = await tx.payment.aggregate({ where: { orderId: order.id }, _max: { attempt: true } });
  const attempt = (last._max.attempt ?? 0) + 1;
  await tx.payment.create({
    data: {
      orderId: order.id,
      userId: order.userId,
      type: "COD_COLLECTION",
      method: "COD",
      attempt,
      reference: paymentReference(order.orderNumber, attempt),
      amountCents: order.totalCents,
      currency: order.currency,
      status: "SUCCEEDED",
      completedAt: at,
    },
  });
}
