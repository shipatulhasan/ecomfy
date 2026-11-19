import { handleSslczCallback } from "@/lib/payments/sslcommerz";
import { callbackRedirect, dropCallbacks, formFields } from "@/lib/payments/redirect";

/**
 * SSLCommerz POSTs the customer's browser here (form data, cross-site: no
 * session cookie, so everything is looked up by tran_id). 303 → result page.
 */
export async function POST(request: Request) {
  const fields = await formFields(request);
  if (dropCallbacks()) {
    console.warn("[payments] PAYMENTS_DROP_CALLBACK: SSLCommerz success redirect dropped", fields.tran_id);
    return callbackRedirect({ outcome: "pending", orderId: fields.value_a || null });
  }
  const result = await handleSslczCallback("success", fields);
  return callbackRedirect(result);
}
