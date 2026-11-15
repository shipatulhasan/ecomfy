import { z } from "zod";

/**
 * Account orders: the public order number ("4152", shown as "Order 4152" in the PNGs) or
 * the full reference ("ECF-004152"), normalized to the Order.number int.
 */
export const orderNumberSchema = z
  .string()
  .trim()
  .regex(/^(?:\d{1,9}|ECF-\d{6,9})$/i)
  .transform((s) => Number(s.replace(/\D/g, "")))
  .pipe(z.number().int().min(1));

/** /account/orders?page=N. Garbage → page 1; out of range is handled by the page. */
export const ordersSearchSchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).catch(1),
});

/** Cancel order / Order again. */
export const orderActionSchema = z.object({ orderNumber: z.union([z.number().int().min(1), orderNumberSchema]) });

export type OrderActionInput = z.infer<typeof orderActionSchema>;
