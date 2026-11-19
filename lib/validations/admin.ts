import { z } from "zod";
import { bdPhoneSchema } from "./address";
import { signInSchema } from "./auth";

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));
const newPassword = z.string().min(8, "At least 8 characters").max(128, "At most 128 characters");
const token = z.string().trim().min(16, "This invitation link is invalid").max(128);

/** Admin Login.png: same fields as the storefront Sign In. */
export const adminSignInSchema = signInSchema;

/** Register.png (invite link): email is fixed by the invite, so only the token is posted. */
export const acceptInviteSchema = z
  .object({
    token,
    password: newPassword,
    confirmPassword: z.string(),
    acceptTerms: z.preprocess(
      (v) => v === true || v === "on" || v === "true",
      z.literal(true, { error: "Please accept the terms & conditions" }),
    ),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

/** Add Members drawer (Add Members.png), minus "Set Initial Password": the invitee sets it. */
export const inviteMemberSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(50),
  lastName: z.string().trim().max(50).optional().default(""),
  email,
  phone: z.union([z.literal(""), bdPhoneSchema]).optional().default(""),
  staffRoleId: z.string().trim().min(1, "Choose a role").max(64),
  /** Set after "This email has a customer account — upgrade to staff?" is confirmed. */
  upgrade: z.preprocess((v) => v === true || v === "on" || v === "true" || v === "1", z.boolean()).optional().default(false),
});

/** /admin/login/verify: authenticator code (6 digits) or a backup code. */
export const twoFactorSignInSchema = z
  .object({
    code: z.string().trim().min(6, "Enter the code").max(32),
    mode: z.enum(["totp", "backup"]).default("totp"),
    trustDevice: z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean()).optional(),
    callbackUrl: z.string().max(512).optional(),
  })
  .refine((v) => v.mode !== "totp" || /^\d{6}$/.test(v.code.replace(/\s/g, "")), {
    path: ["code"],
    message: "Enter the 6-digit code from your authenticator app",
  })
  .transform((v) => ({ ...v, code: v.mode === "totp" ? v.code.replace(/\s/g, "") : v.code }));

export const inviteIdSchema = z.object({ id: z.string().min(1).max(64) });

/** Command palette query. */
export const adminSearchSchema = z.object({ q: z.string().trim().min(1).max(80) });

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
