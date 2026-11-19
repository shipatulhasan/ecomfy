import { z } from "zod";
import { notificationPrefsSchema } from "@/lib/admin/notifications";
import { bdPhoneSchema } from "./address";
import { profileSchema } from "./auth";

export { changePasswordSchema } from "./auth";

/**
 * Admin General Info (Account & Settings.png) → Profile Update. Always the signed-in
 * user's own record: none of these schemas accepts a user id.
 */
export const adminProfileSchema = profileSchema.extend({
  phone: z.union([z.literal(""), bdPhoneSchema]).optional().default(""),
  dateOfBirth: z
    .union([z.literal(""), z.iso.date("Pick a date")])
    .optional()
    .default("")
    .refine((v) => !v || (v >= "1900-01-01" && new Date(v) < new Date()), "Pick a date in the past"),
  location: z.string().trim().max(200).optional().default(""),
  bio: z.string().trim().max(1000, "At most 1000 characters").optional().default(""),
});

export const changeEmailSchema = z.object({ newEmail: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")) });

export const passwordOnlySchema = z.object({ password: z.string().min(1, "Enter your password").max(128) });

export const totpCodeSchema = z.object({
  code: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{6}$/, "Enter the 6-digit code")),
});

export const avatarSchema = z.object({ key: z.string().max(80).nullable() });

export const sessionTokenSchema = z.object({ id: z.string().min(1).max(64) });

export const notificationsSchema = notificationPrefsSchema;
