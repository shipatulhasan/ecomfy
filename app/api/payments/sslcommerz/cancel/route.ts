import { handleSslczCallback } from "@/lib/payments/sslcommerz";
import { callbackRedirect, formFields } from "@/lib/payments/redirect";

/**
 * SSLCommerz POSTs the customer's browser here (form data, cross-site: no
 * session cookie, so everything is looked up by tran_id). 303 → result page.
 */
export async function POST(request: Request) {
  const result = await handleSslczCallback("cancel", await formFields(request));
  return callbackRedirect(result);
}
