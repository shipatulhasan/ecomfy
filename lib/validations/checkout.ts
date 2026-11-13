import { z } from "zod";
import { PAYMENT_METHODS } from "@/lib/config/checkout";
import { DISTRICTS } from "@/lib/config/districts";
import { CURRENCIES } from "@/lib/money";
import { addressSchema } from "./address";

export const paymentMethodSchema = z.enum(PAYMENT_METHODS, "Choose a payment method");

// Checkout form → placeOrder. Totals are never sent: the server recomputes them.
export const checkoutSchema = z
  .object({
    idempotencyKey: z.uuid(),
    billing: addressSchema,
    shipToDifferentAddress: z.boolean().default(false),
    shipping: addressSchema.optional(),
    notes: z
      .string()
      .trim()
      .max(1000)
      .optional()
      .transform((v) => v || undefined),
    paymentMethod: paymentMethodSchema,
    saveAddress: z.boolean().default(false),
    /** What the customer saw (display fields only; the charge is always BDT). */
    displayCurrency: z.enum(CURRENCIES).default("BDT"),
  })
  .refine((v) => !v.shipToDifferentAddress || v.shipping, {
    path: ["shipping"],
    message: "Enter the shipping address",
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

// Live totals when the district or the payment method changes.
export const quoteSchema = z.object({
  district: z.enum(DISTRICTS).nullable(),
  paymentMethod: paymentMethodSchema,
});

// /checkout/failed: "Try again" (same method) or "Change method" on the SAME order.
export const retryPaymentSchema = z.object({
  orderId: z.string().min(1).max(40),
  paymentMethod: paymentMethodSchema,
});
