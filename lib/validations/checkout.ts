import { z } from "zod";
import { addressSchema } from "./address";

export const paymentMethods = [
  "CASH_ON_DELIVERY",
  "PAYPAL",
  "AMAZON_PAY",
  "CARD",
  "BANK_TRANSFER",
] as const;

// Checkout screen: billing info, optional different shipping address, notes, payment.
export const checkoutSchema = z
  .object({
    billing: addressSchema,
    shipToDifferentAddress: z.boolean().default(false),
    shipping: addressSchema.optional(),
    notes: z.string().trim().max(1000).optional(),
    paymentMethod: z.enum(paymentMethods),
  })
  .refine((v) => !v.shipToDifferentAddress || v.shipping, {
    path: ["shipping"],
    message: "Shipping address is required",
  });

// Cart line mutations (add to cart, quantity stepper).
export const cartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
});

export const couponCodeSchema = z.object({
  code: z.string().trim().toUpperCase().min(1, "Enter a coupon code").max(32),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CartItemInput = z.infer<typeof cartItemSchema>;
