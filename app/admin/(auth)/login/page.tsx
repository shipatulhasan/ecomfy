import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/auth/admin-login-form";
import { AuthCard } from "@/components/admin/auth/auth-card";

export const metadata: Metadata = { title: "Login" };

/** Login.png. Staff / admin accounts only; proxy.ts sends signed-in staff on to /admin. */
export default function AdminLoginPage() {
  return (
    <AuthCard subtitle="Sign In to Get Started">
      <AdminLoginForm />
    </AuthCard>
  );
}
