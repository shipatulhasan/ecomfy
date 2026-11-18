import { z } from "zod";
import { orderNumberSchema } from "./orders";

/**
 * Admin → Order Management. Every mutation carries the `version` the admin loaded
 * (optimistic concurrency): a change made meanwhile (another tab, a customer
 * cancel, a gateway callback) makes the action fail with "reload".
 */

const orderRef = z.union([z.number().int().min(1), orderNumberSchema]);
const version = z.number().int().min(0);

export const ADMIN_ORDER_LIMITS = { note: 1000, reason: 300, courier: 60, tracking: 80, url: 500, bulk: 100 } as const;

const trimmed = (max: number) => z.string().trim().max(max, `At most ${max} characters`);
const optionalText = (max: number) =>
  trimmed(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const trackingUrlSchema = z
  .string()
  .trim()
  .max(ADMIN_ORDER_LIMITS.url)
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Enter a full link (https://…)")
  .optional()
  .transform((v) => (v ? v : undefined));

export const shipmentSchema = z.object({
  courier: z.string().trim().min(1, "Pick a courier").max(ADMIN_ORDER_LIMITS.courier),
  trackingNumber: z
    .string()
    .trim()
    .min(1, "Enter the tracking number")
    .max(ADMIN_ORDER_LIMITS.tracking)
    .regex(/^[\w\-./ ]+$/, "Letters, numbers, dashes and slashes only"),
  trackingUrl: trackingUrlSchema,
});

export type ShipmentInput = z.input<typeof shipmentSchema>;

/** Statuses an admin may set (the transitions map decides which apply to an order). */
export const ADMIN_TARGETS = ["PROCESSING", "SHIPPED", "DELIVERED", "RETURNED", "CANCELLED"] as const;
export type AdminTarget = (typeof ADMIN_TARGETS)[number];

const shipmentFields = {
  courier: optionalText(ADMIN_ORDER_LIMITS.courier),
  trackingNumber: optionalText(ADMIN_ORDER_LIMITS.tracking),
  trackingUrl: trackingUrlSchema,
};

export const changeStatusSchema = z
  .object({
    orderNumber: orderRef,
    version,
    to: z.enum(ADMIN_TARGETS),
    note: optionalText(ADMIN_ORDER_LIMITS.note),
    reason: optionalText(ADMIN_ORDER_LIMITS.reason),
    ...shipmentFields,
  })
  .superRefine(requireShipmentAndReason);

export const bulkStatusSchema = z
  .object({
    to: z.enum(ADMIN_TARGETS),
    reason: optionalText(ADMIN_ORDER_LIMITS.reason),
    items: z
      .array(z.object({ orderNumber: orderRef, version, ...shipmentFields }))
      .min(1, "Select at least one order")
      .max(ADMIN_ORDER_LIMITS.bulk, `At most ${ADMIN_ORDER_LIMITS.bulk} orders at a time`),
  })
  .superRefine((v, ctx) => {
    if (v.to === "CANCELLED" && !v.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Enter a reason" });
    if (v.to !== "SHIPPED") return;
    v.items.forEach((item, i) => {
      const r = shipmentSchema.safeParse(shipmentInput(item));
      if (!r.success) {
        for (const issue of r.error.issues) ctx.addIssue({ code: "custom", path: ["items", i, ...issue.path], message: issue.message });
      }
    });
  });

function requireShipmentAndReason(
  v: { to: AdminTarget; reason?: string; courier?: string; trackingNumber?: string; trackingUrl?: string },
  ctx: z.RefinementCtx,
) {
  if (v.to === "CANCELLED" && !v.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Enter a reason" });
  if (v.to === "SHIPPED") {
    const r = shipmentSchema.safeParse(shipmentInput(v));
    if (!r.success) for (const issue of r.error.issues) ctx.addIssue({ code: "custom", path: issue.path, message: issue.message });
  }
}

/** Blank optional fields arrive as undefined: check them as "" so the messages read "Pick a courier", … */
const shipmentInput = (v: { courier?: string; trackingNumber?: string; trackingUrl?: string }) => ({
  courier: v.courier ?? "",
  trackingNumber: v.trackingNumber ?? "",
  trackingUrl: v.trackingUrl,
});

export const updateShippingSchema = shipmentSchema.extend({ orderNumber: orderRef, version });

export const internalNoteSchema = z.object({
  orderNumber: orderRef,
  note: z.string().trim().min(1, "Write a note").max(ADMIN_ORDER_LIMITS.note, `At most ${ADMIN_ORDER_LIMITS.note} characters`),
});

/** Refund amount in taka (2 decimals) from the dialog; converted to cents on the server. */
export const refundSchema = z.object({
  orderNumber: orderRef,
  version,
  amount: z.coerce.number().positive("Enter an amount").max(10_000_000).multipleOf(0.01, "At most 2 decimals"),
  note: z.string().trim().min(1, "Add a note (method, reference…)").max(ADMIN_ORDER_LIMITS.note),
});

export const resendEmailSchema = z.object({ orderNumber: orderRef });

export type ChangeStatusInput = z.input<typeof changeStatusSchema>;
export type BulkStatusInput = z.input<typeof bulkStatusSchema>;
