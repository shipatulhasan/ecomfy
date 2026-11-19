import { z } from "zod";

/** Admin → Transactions: "Verify with gateway" on one Payment row. */
export const verifyPaymentSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

export type VerifyPaymentInput = z.input<typeof verifyPaymentSchema>;
