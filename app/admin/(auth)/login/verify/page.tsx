import type { Metadata } from "next";
import { AdminTwoFactorForm } from "@/components/admin/auth/admin-two-factor-form";
import { AuthCard } from "@/components/admin/auth/auth-card";

export const metadata: Metadata = { title: "Two-step verification" };

/**
 * Second sign-in step for staff with 2FA on (no design: Login.png card). The
 * password step set a 10-minute two-factor cookie; without it the code is refused.
 */
export default function AdminVerifyPage() {
  return (
    <AuthCard subtitle="Two-step verification">
      <AdminTwoFactorForm />
    </AuthCard>
  );
}
