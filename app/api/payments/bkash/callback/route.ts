import type { NextRequest } from "next/server";
import { handleBkashCallback } from "@/lib/payments/bkash";
import { prisma } from "@/lib/db";
import { callbackRedirect, dropCallbacks } from "@/lib/payments/redirect";

/**
 * bKash redirects the customer here: ?paymentID=…&status=success|failure|cancel.
 * Execute / Query confirm the payment server-side; repeats are no-ops.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (dropCallbacks() && params.get("status") === "success") {
    const paymentId = params.get("paymentID") ?? params.get("paymentId") ?? "";
    const p = paymentId ? await prisma.payment.findUnique({ where: { paymentId }, select: { orderId: true } }) : null;
    console.warn("[payments] PAYMENTS_DROP_CALLBACK: bKash success callback dropped", paymentId);
    return callbackRedirect({ outcome: "pending", orderId: p?.orderId ?? null });
  }
  const result = await handleBkashCallback(request.nextUrl.searchParams);
  return callbackRedirect(result);
}
