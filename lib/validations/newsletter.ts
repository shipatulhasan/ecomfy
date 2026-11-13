import { z } from "zod";

// Newsletter band (every shop page) and Newsletter popup.
// Normalize first, then validate (so " Me@Mail.com " is accepted).
export const newsletterSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
});

export type NewsletterInput = z.infer<typeof newsletterSchema>;
