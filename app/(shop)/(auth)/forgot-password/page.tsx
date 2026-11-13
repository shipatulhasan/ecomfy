import type { Metadata } from "next";
import { PageTransition } from "@/components/shared/page-transition";
import { AuthScreen } from "@/components/shop/auth/auth-screen";
import { ForgotPasswordForm } from "@/components/shop/auth/forgot-password-form";

/** Forgot password (no PNG; Sign_In.png styling). */
export const metadata: Metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <PageTransition>
      <AuthScreen crumb="Forgot Password" title="Forgot Password">
        <ForgotPasswordForm />
      </AuthScreen>
    </PageTransition>
  );
}
