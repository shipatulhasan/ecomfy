import { handleSslczCallback } from "@/lib/payments/sslcommerz";
import { formFields } from "@/lib/payments/redirect";

/**
 * SSLCommerz IPN (server to server). Validated exactly like the success redirect;
 * whichever arrives first marks the order, the other is a no-op.
 */
export async function POST(request: Request) {
  const result = await handleSslczCallback("ipn", await formFields(request));
  return new Response(result.outcome, { status: 200, headers: { "Content-Type": "text/plain" } });
}
