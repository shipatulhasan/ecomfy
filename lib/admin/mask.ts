/**
 * Partial masking of customer contact details for STAFF (admin Transactions).
 * Applied on the server before data leaves the query, never in the browser.
 */

/** "rahim.uddin@gmail.com" → "ra*******@gmail.com" */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at < 1) return "***";
  const local = email.slice(0, at);
  const keep = local.length <= 2 ? 1 : 2;
  return `${local.slice(0, keep)}${"*".repeat(Math.max(3, local.length - keep))}${email.slice(at)}`;
}

/** "01712345678" → "017*****678" (keeps the operator prefix and the last 3 digits). */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "*".repeat(digits.length || 3);
  return `${digits.slice(0, 3)}${"*".repeat(digits.length - 6)}${digits.slice(-3)}`;
}
