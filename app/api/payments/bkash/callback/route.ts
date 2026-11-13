import type { NextRequest } from "next/server";
import { handleBkashCallback } from "@/lib/payments/bkash";
import { callbackRedirect } from "@/lib/payments/redirect";

/**
 * bKash redirects the customer here: ?paymentID=…&status=success|failure|cancel.
 * Execute / Query confirm the payment server-side; repeats are no-ops.
 */
export async function GET(request: NextRequest) {
  const result = await handleBkashCallback(request.nextUrl.searchParams);
  return callbackRedirect(result);
}
