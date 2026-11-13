import { z } from "zod";

// Checkout "Billing Information" and Settings "Billing Address".
// Also the shape stored in Order.billingAddress / Order.shippingAddress (JSON).
export const addressSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(60),
  companyName: z.string().trim().max(100).optional(),
  street: z.string().trim().min(1, "Required").max(200),
  country: z.string().trim().min(1, "Required"),
  state: z.string().trim().min(1, "Required"),
  zip: z.string().trim().min(1, "Required").max(20),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().min(5, "Enter a valid phone number").max(30),
});

export type AddressInput = z.infer<typeof addressSchema>;
