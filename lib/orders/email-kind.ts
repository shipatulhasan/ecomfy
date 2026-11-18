/** Customer emails for order status changes (sent by lib/orders/emails.ts). Pure. */
export type OrderEmailKind = "confirmed" | "shipped" | "delivered" | "cancelled" | "returned";

/** The email that goes with a status (Resend email button); null when there's none. */
export function emailKindFor(status: string): OrderEmailKind | null {
  switch (status) {
    case "PROCESSING":
      return "confirmed";
    case "SHIPPED":
      return "shipped";
    case "DELIVERED":
      return "delivered";
    case "CANCELLED":
      return "cancelled";
    case "RETURNED":
      return "returned";
    default:
      return null;
  }
}
