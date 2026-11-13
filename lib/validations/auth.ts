import { z } from "zod";
import { bdPhoneSchema } from "./address";

// Checkbox values arrive as "on" from FormData (or a boolean from code).
const checkbox = z.preprocess((v) => v === true || v === "on" || v === "true", z.boolean());
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"));
const newPassword = z.string().min(8, "At least 8 characters").max(128, "At most 128 characters");
const callbackUrl = z.string().max(512).optional();

// Sign In / Create Account screens (storefront + admin Login/Register).
export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Password is required").max(128),
  rememberMe: checkbox.optional(),
  callbackUrl,
});

// Create_Account.png has no name field: the name defaults to the email's local
// part (lib/actions/auth.ts) and is edited in Settings.
export const signUpSchema = z
  .object({
    name: z.string().trim().max(100).optional(),
    email,
    password: newPassword,
    confirmPassword: z.string(),
    acceptTerms: z.preprocess(
      (v) => v === true || v === "on" || v === "true",
      z.literal(true, { error: "Please accept the terms & conditions" }),
    ),
    callbackUrl,
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

// Forgot password (request a link) and Reset password (?token=).
export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "This link is invalid").max(512),
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

// Settings → Account Settings (Settings.png: first name, last name, email (read-only), phone).
export const profileSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(50),
  lastName: z.string().trim().max(50).optional().default(""),
  // Optional; when given, a Bangladesh mobile normalized to 01XXXXXXXXX (as at checkout).
  phone: z.union([z.literal(""), bdPhoneSchema]).optional().default(""),
});

// Settings → Change Password.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Choose a password you haven't used here",
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
