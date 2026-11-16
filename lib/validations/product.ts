import { z } from "zod";

// Admin product / variant schemas: lib/validations/admin-product.ts.

// PDP → Customer Feedback.
export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(3, "Tell us a bit more").max(2000),
});

export const reviewPageSchema = z.object({
  productId: z.string().min(1),
  page: z.number().int().min(2).max(500),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
