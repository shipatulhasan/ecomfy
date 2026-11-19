import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { formatPrice } from "@/lib/money";
import { absoluteUrl } from "@/lib/site-url";
import type { OrderEmailKind } from "./email-kind";

export { emailKindFor, type OrderEmailKind } from "./email-kind";

/**
 * Customer emails for order status changes, sent after the response (`after()`),
 * so a slow or missing mail provider never blocks or fails the change itself.
 * lib/mail.ts logs them in development and skips them (with a warning) when no
 * provider is configured in production.
 */
export function queueOrderEmail(orderId: string, kind: OrderEmailKind) {
  after(() => sendOrderEmail(orderId, kind));
}

export async function sendOrderEmail(orderId: string, kind: OrderEmailKind): Promise<void> {
  try {
    const o = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        email: true,
        number: true,
        orderNumber: true,
        userId: true,
        totalCents: true,
        paymentMethod: true,
        paymentStatus: true,
        courier: true,
        trackingNumber: true,
        trackingUrl: true,
        cancelReason: true,
      },
    });
    if (!o) return;
    const link = o.userId ? absoluteUrl(`/account/orders/${o.number}`) : undefined;
    const due = o.paymentMethod === "COD" && o.paymentStatus !== "PAID" ? ` Please keep ${formatPrice(o.totalCents)} ready for the courier.` : "";

    const mail: Record<OrderEmailKind, { subject: string; text: string }> = {
      confirmed: {
        subject: `Order ${o.orderNumber} confirmed`,
        text: `Good news! We've confirmed order ${o.orderNumber} and are packing it now.${due}`,
      },
      shipped: {
        subject: `Order ${o.orderNumber} is on the way`,
        text:
          `Order ${o.orderNumber} has been handed to ${o.courier ?? "our courier"}` +
          (o.trackingNumber ? ` (tracking number ${o.trackingNumber})` : "") +
          "." +
          (o.trackingUrl ? ` Track it here: ${o.trackingUrl}` : "") +
          due,
      },
      delivered: {
        subject: `Order ${o.orderNumber} delivered`,
        text: `Order ${o.orderNumber} has been delivered. Thanks for shopping with {store}!`,
      },
      cancelled: {
        subject: `Order ${o.orderNumber} cancelled`,
        text: `Order ${o.orderNumber} has been cancelled.${o.cancelReason ? ` Reason: ${o.cancelReason}.` : ""}`,
      },
      returned: {
        subject: `Order ${o.orderNumber} returned`,
        text: `We've recorded the return of order ${o.orderNumber}. Any refund is processed separately.`,
      },
    };
    await sendMail({ to: o.email, ...mail[kind], link });
  } catch (err) {
    console.warn(`[mail] order ${kind} email failed`, String(err));
  }
}
