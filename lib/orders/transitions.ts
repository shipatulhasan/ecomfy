import type { OrderStatus, PaymentMethod } from "@/lib/generated/prisma/enums";

/**
 * The ONE order status map. Every writer (admin actions, customer cancel / retry,
 * the payment state machine, expiry) asks `canTransition()` before it changes
 * `Order.status`; any pair not listed here is rejected on the server.
 *
 * Each edge lists who may take it:
 *   admin    → Order Management (lib/actions/admin-orders.ts)
 *   customer → account actions (cancel, pay again)
 *   system   → gateway callbacks / expiry (lib/payments/state.ts)
 *
 * Pure module: the admin UI reads it too, to show only valid next steps.
 */
export type TransitionActor = "admin" | "customer" | "system";

type Edges = Partial<Record<OrderStatus, readonly TransitionActor[]>>;

const RULES: Record<OrderStatus, Edges> = {
  PENDING_PAYMENT: {
    PROCESSING: ["system"], // paid callback
    EXPIRED: ["system"],
    FAILED: ["system"], // gateway failure
    CANCELLED: ["admin", "customer", "system"], // system: cancelled at the gateway
    PENDING_PAYMENT: ["customer"], // pay again (new attempt)
    PENDING_CONFIRMATION: ["customer"], // pay again with COD
  },
  PENDING_CONFIRMATION: {
    PROCESSING: ["admin"], // confirm COD
    CANCELLED: ["admin", "customer"],
  },
  PROCESSING: {
    SHIPPED: ["admin"],
    CANCELLED: ["admin"],
  },
  SHIPPED: {
    DELIVERED: ["admin"],
    RETURNED: ["admin"],
  },
  DELIVERED: {
    RETURNED: ["admin"], // within Settings.returnWindowDays
  },
  // Left the flow before payment: the customer may pay again; a late gateway
  // success still lands (money is never lost; see markPaid).
  FAILED: { PENDING_PAYMENT: ["customer"], PENDING_CONFIRMATION: ["customer"], PROCESSING: ["system"] },
  EXPIRED: { PENDING_PAYMENT: ["customer"], PENDING_CONFIRMATION: ["customer"], PROCESSING: ["system"] },
  // Only gateway cancellations (cancelledAt = null) reopen; staff / customer
  // cancellations are final (checked by the callers through `cancelledAt`).
  CANCELLED: { PENDING_PAYMENT: ["customer"], PENDING_CONFIRMATION: ["customer"], PROCESSING: ["system"] },
  RETURNED: {},
};

export type TransitionContext = {
  actor: TransitionActor;
  /** DELIVERED → RETURNED window. */
  deliveredAt?: Date | null;
  returnWindowDays?: number;
  now?: Date;
};

export function canTransition(from: OrderStatus, to: OrderStatus, ctx: TransitionContext): boolean {
  const actors = RULES[from][to];
  if (!actors?.includes(ctx.actor)) return false;
  if (from === "DELIVERED" && to === "RETURNED") {
    if (!ctx.deliveredAt || ctx.returnWindowDays == null) return false;
    const deadline = ctx.deliveredAt.getTime() + ctx.returnWindowDays * 86_400_000;
    return (ctx.now ?? new Date()).getTime() <= deadline;
  }
  return true;
}

/** Throws for a transition the map doesn't allow (programming error in a writer). */
export function assertTransition(from: OrderStatus, to: OrderStatus, actor: TransitionActor): void {
  if (!canTransition(from, to, { actor, deliveredAt: new Date(), returnWindowDays: 1 })) {
    throw new Error(`Order transition ${from} → ${to} is not allowed for ${actor}`);
  }
}

/** Why a transition isn't allowed, phrased for the admin's per-order report. */
export function transitionBlockReason(from: OrderStatus, to: OrderStatus, ctx: TransitionContext): string {
  if (from === to) return `already ${ADMIN_STATUS_WORD[from]}`;
  if (from === "DELIVERED" && to === "RETURNED" && RULES[from][to]?.includes(ctx.actor)) return "return window has passed";
  return `is ${ADMIN_STATUS_WORD[from]}, can't be ${ADMIN_STATUS_WORD[to]}`;
}

const ADMIN_STATUS_WORD: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "awaiting payment",
  PENDING_CONFIRMATION: "awaiting confirmation",
  PROCESSING: "confirmed",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  FAILED: "payment failed",
  RETURNED: "returned",
};

/** Statuses an admin may move this order to, in display order. */
export function adminNextStatuses(order: {
  status: OrderStatus;
  deliveredAt?: Date | string | null;
  returnWindowDays?: number;
}): OrderStatus[] {
  const ctx: TransitionContext = {
    actor: "admin",
    deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : null,
    returnWindowDays: order.returnWindowDays,
  };
  return ADMIN_ORDER.filter((to) => canTransition(order.status, to, ctx));
}

const ADMIN_ORDER: OrderStatus[] = ["PROCESSING", "SHIPPED", "DELIVERED", "RETURNED", "CANCELLED"];

/** Button label for an admin move to `to`. */
export function transitionLabel(to: OrderStatus, method?: PaymentMethod): string {
  switch (to) {
    case "PROCESSING":
      return method === "COD" ? "Confirm order" : "Mark processing";
    case "SHIPPED":
      return "Mark shipped";
    case "DELIVERED":
      return "Mark delivered";
    case "RETURNED":
      return "Mark returned";
    case "CANCELLED":
      return "Cancel order";
    default:
      return to;
  }
}

/** The order's next logical step (the detail page's primary button); never Cancel / Return. */
export function primaryNext(order: Parameters<typeof adminNextStatuses>[0]): OrderStatus | null {
  return adminNextStatuses(order).find((s) => s === "PROCESSING" || s === "SHIPPED" || s === "DELIVERED") ?? null;
}

/** Statuses an order can still be cancelled from by staff. */
export const isAdminCancellable = (s: OrderStatus) => canTransition(s, "CANCELLED", { actor: "admin" });
