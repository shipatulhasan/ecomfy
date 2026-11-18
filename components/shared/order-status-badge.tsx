import { StatusChip } from "@/components/shared/status-chip";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";
import { adminStatusView, orderStatusView, paymentStatusView } from "@/lib/orders/status";

/**
 * The one order-status pill (account dashboard, Order History, Order Details,
 * the admin order detail). Labels and tones come from lib/orders/status.ts.
 */
type OrderBadgeProps = {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  method: PaymentMethod;
  className?: string;
};

/** `variant="admin"`: Order Management wording ("Shipped", "Delivered", "To confirm"). */
export function OrderStatusBadge({ status, paymentStatus, method, className, variant = "customer" }: OrderBadgeProps & { variant?: "customer" | "admin" }) {
  const v = (variant === "admin" ? adminStatusView : orderStatusView)(status, paymentStatus, method);
  return (
    <StatusChip tone={v.tone} className={className}>
      {v.label}
    </StatusChip>
  );
}

/** "Cash on delivery: unpaid", "Paid via bKash", … shown next to the status where it matters. */
export function PaymentStatusBadge({ paymentStatus, method, className }: Omit<OrderBadgeProps, "status">) {
  const v = paymentStatusView(method, paymentStatus);
  return (
    <StatusChip tone={v.tone} className={className}>
      {v.label}
    </StatusChip>
  );
}
