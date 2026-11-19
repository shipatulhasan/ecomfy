import "server-only";
import { appUrl } from "@/lib/env";
import type { CallbackResult } from "./types";

/**
 * Where the browser goes after a gateway callback (303 so a POST becomes a GET).
 * Paid / still confirming → success page (it shows "confirming" until paid);
 * failed / cancelled → failed page with retry options.
 */
export function callbackRedirect(result: CallbackResult): Response {
  let path: string;
  if (!result.orderId) path = "/checkout/failed?reason=unknown";
  else if (result.outcome === "paid" || result.outcome === "pending" || (result.outcome === "noop" && result.paid)) {
    path = `/checkout/success?id=${encodeURIComponent(result.orderId)}`;
  } else {
    const reason = result.outcome === "cancelled" ? "cancelled" : "failed";
    path = `/checkout/failed?id=${encodeURIComponent(result.orderId)}&reason=${reason}`;
  }
  return new Response(null, { status: 303, headers: { Location: appUrl(path), "Cache-Control": "no-store" } });
}

/** Form-encoded POST body → plain fields. */
export async function formFields(request: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const form = await request.formData();
    for (const [k, v] of form) if (typeof v === "string") out[k] = v;
  } catch {
    // Not form data: nothing to read.
  }
  return out;
}

/**
 * Dev-only switch (PAYMENTS_DROP_CALLBACK=1, never in production): success
 * callbacks and IPNs are ignored, as if the gateway's callback never arrived, so
 * reconciliation (admin "Verify with gateway", /api/cron/reconcile-payments) can
 * be exercised against the sandbox. The attempt stays PENDING.
 */
export const dropCallbacks = () => process.env.NODE_ENV !== "production" && process.env.PAYMENTS_DROP_CALLBACK === "1";
