import { z } from "zod";
import { DISTRICTS } from "@/lib/config/districts";

/**
 * Bangladesh mobile number. Accepts "+880 1712-345678", "8801712345678",
 * "01712345678"; normalizes to "01712345678" (operator prefixes 013–019).
 */
export const BD_PHONE = /^01[3-9]\d{8}$/;
export const normalizeBdPhone = (raw: string) => {
  const digits = raw.replace(/[\s()-]/g, "").replace(/^\+/, "");
  return digits.startsWith("880") ? digits.slice(2) : digits;
};
export const bdPhoneSchema = z
  .string()
  .trim()
  .transform(normalizeBdPhone)
  .pipe(z.string().regex(BD_PHONE, "Enter a Bangladesh mobile number (01XXXXXXXXX)"));

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

// Checkout "Billing Information" / "Shipping Address" (Bangladesh-first) and the
// saved Address. Also the shape stored in Order.billingAddress / shippingAddress (JSON).
export const addressSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name").max(60),
  lastName: z.string().trim().min(1, "Enter your last name").max(60),
  companyName: optionalText(100),
  street: z.string().trim().min(3, "Enter your street address").max(200),
  city: z.string().trim().min(2, "Enter your area / thana").max(80),
  district: z.enum(DISTRICTS, "Choose a district"),
  zip: z.string().trim().regex(/^\d{4}$/, "Postcode is 4 digits"),
  email: z.email("Enter a valid email").max(254),
  phone: bdPhoneSchema,
});

export type AddressInput = z.infer<typeof addressSchema>;
/** Before parsing (the form's state). */
export type AddressDraft = z.input<typeof addressSchema>;
