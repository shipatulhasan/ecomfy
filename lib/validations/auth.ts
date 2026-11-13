import { z } from "zod";

// Sign In / Create Account screens (storefront + admin Login/Register).
export const signInSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { error: "Please accept the terms & conditions" }),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

// Settings → Change Password.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
