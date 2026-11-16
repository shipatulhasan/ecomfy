import type { Metadata } from "next";
import { AdminForgotPasswordForm } from "@/components/admin/auth/admin-password-forms";
import { AuthCard } from "@/components/admin/auth/auth-card";

export const metadata: Metadata = { title: "Forgot password" };

/** No PNG: the Login card, admin-styled, reusing Better Auth's reset flow. */
export default function AdminForgotPasswordPage() {
  return (
    <AuthCard title="Forgot password?" subtitle="We'll email you a link to reset it">
      <AdminForgotPasswordForm />
    </AuthCard>
  );
}
