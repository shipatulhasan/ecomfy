import { paymentMethodMeta } from "@/lib/config/checkout";
import type { OrderStatus, PaymentAttemptStatus, PaymentMethod, PaymentStatus, PaymentType } from "@/lib/generated/prisma/enums";

/**
 * Customer-facing order status (account dashboard, order history, order details).
 * Tones map to token colors in components/shared/status-chip.tsx.
 *
 *   PENDING_PAYMENT       → "Pending payment"      (online payment not finished)
 *   PENDING_CONFIRMATION  → "Cash on delivery" for COD, else "Pending confirmation"
 *   PROCESSING → "Processing", SHIPPED → "On the way", DELIVERED → "Completed"
 *   CANCELLED → "Cancelled", EXPIRED → "Expired", FAILED → "Payment failed"
 */
export type StatusTone = "neutral" | "warning" | "info" | "success" | "danger";

export type OrderStatusView = { label: string; tone: StatusTone };

export function orderStatusView(
  status: OrderStatus,
  _paymentStatus: PaymentStatus,
  paymentMethod: PaymentMethod,
): OrderStatusView {
  switch (status) {
    case "PENDING_PAYMENT":
      return { label: "Pending payment", tone: "warning" };
    case "PENDING_CONFIRMATION":
      return paymentMethod === "COD"
        ? { label: "Cash on delivery", tone: "warning" }
        : { label: "Pending confirmation", tone: "warning" };
    case "PROCESSING":
      return { label: "Processing", tone: "info" };
    case "SHIPPED":
      return { label: "On the way", tone: "info" };
    case "DELIVERED":
      return { label: "Completed", tone: "success" };
    case "CANCELLED":
      return { label: "Cancelled", tone: "danger" };
    case "EXPIRED":
      return { label: "Expired", tone: "neutral" };
    case "FAILED":
      return { label: "Payment failed", tone: "danger" };
    case "RETURNED":
      return { label: "Returned", tone: "neutral" };
  }
}

/**
 * Admin wording of an order status (Order Management.png: "Pending", "Shipped",
 * "Delivered", "Cancelled"). Same tones as the customer view.
 */
export const ADMIN_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PENDING_CONFIRMATION: "To confirm",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  FAILED: "Payment failed",
  RETURNED: "Returned",
};

export function adminStatusView(status: OrderStatus, paymentStatus: PaymentStatus, method: PaymentMethod): OrderStatusView {
  return { label: ADMIN_STATUS_LABELS[status], tone: orderStatusView(status, paymentStatus, method).tone };
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  UNPAID: "Unpaid",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
};

/**
 * Payment line shown next to the order status (summary card, invoice, cards):
 * "Cash on delivery: unpaid", "Paid via bKash", "Payment failed", "Refunded".
 */
export function paymentStatusView(method: PaymentMethod, paymentStatus: PaymentStatus): OrderStatusView {
  switch (paymentStatus) {
    case "PAID":
      return method === "COD"
        ? { label: "Paid in cash", tone: "success" }
        : { label: `Paid via ${paymentMethodLabel(method)}`, tone: "success" };
    case "FAILED":
      return { label: "Payment failed", tone: "danger" };
    case "REFUNDED":
      return { label: "Refunded", tone: "neutral" };
    case "UNPAID":
      return method === "COD"
        ? { label: "Cash on delivery: unpaid", tone: "warning" }
        : { label: `${paymentMethodLabel(method)}: unpaid`, tone: "warning" };
  }
}

/** Tracker steps (Order_Details.png) and the statuses that reach each one. */
export const ORDER_STEPS = [
  { label: "Order received", reachedBy: ["PENDING_PAYMENT", "PENDING_CONFIRMATION"] },
  { label: "Processing", reachedBy: ["PROCESSING"] },
  { label: "On the way", reachedBy: ["SHIPPED"] },
  { label: "Delivered", reachedBy: ["DELIVERED"] },
] as const satisfies readonly { label: string; reachedBy: readonly OrderStatus[] }[];

/** Orders that left the flow: a banner replaces the tracker. */
export const isClosedStatus = (s: OrderStatus) => s === "CANCELLED" || s === "EXPIRED" || s === "FAILED" || s === "RETURNED";

/** Statuses a customer may cancel from (lib/actions/orders.ts → cancelOrder). */
export const CANCELLABLE_STATUSES = ["PENDING_PAYMENT", "PENDING_CONFIRMATION"] as const satisfies readonly OrderStatus[];

/**
 * Order Details progress tracker: 0 received · 1 processing · 2 on the way ·
 * 3 delivered. Null for orders that left the flow (cancelled, expired, failed).
 */
export function orderProgressStep(status: OrderStatus): number | null {
  switch (status) {
    case "PENDING_PAYMENT":
    case "PENDING_CONFIRMATION":
      return 0;
    case "PROCESSING":
      return 1;
    case "SHIPPED":
      return 2;
    case "DELIVERED":
      return 3;
    default:
      return null;
  }
}

/** Checkout's labels (lib/config/checkout.ts), e.g. "Cash on Delivery". */
export const paymentMethodLabel = (m: PaymentMethod): string => paymentMethodMeta[m].label;

// ───────────────────────────── payment rows (attempts / ledger) ─────────────────────────────

/** One Payment row's status (order detail attempts, admin Transactions). */
export const ATTEMPT_TONE: Record<PaymentAttemptStatus, StatusTone> = {
  INITIATED: "neutral",
  PENDING: "warning",
  SUCCEEDED: "success",
  FAILED: "danger",
  CANCELLED: "danger",
  EXPIRED: "neutral",
  REFUNDED: "info",
};
export const ATTEMPT_LABEL: Record<PaymentAttemptStatus, string> = {
  INITIATED: "Started",
  PENDING: "Pending",
  SUCCEEDED: "Complete",
  FAILED: "Failed",
  CANCELLED: "Canceled",
  EXPIRED: "Expired",
  REFUNDED: "Refunded",
};
export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  CHARGE: "Charge",
  REFUND: "Refund",
  COD_COLLECTION: "COD collection",
};
