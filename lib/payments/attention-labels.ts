/** "Needs attention" reasons (rules: lib/payments/attention.ts). Client-safe. */
export const ATTENTION_REASONS = ["stuck", "paid_on_closed", "amount_mismatch", "duplicate"] as const;
export type AttentionReason = (typeof ATTENTION_REASONS)[number];

export const ATTENTION_LABELS: Record<AttentionReason, string> = {
  stuck: "Pending for more than 30 minutes",
  paid_on_closed: "Paid, but the order is cancelled",
  amount_mismatch: "Amount differs from the order total",
  duplicate: "More than one successful charge for this order",
};
