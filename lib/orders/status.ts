import { paymentMethodMeta } from "@/lib/config/checkout";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";

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
  }
}

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
