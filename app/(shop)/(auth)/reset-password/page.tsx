import type { Metadata } from "next";
import { PageTransition } from "@/components/shared/page-transition";
import { AuthScreen } from "@/components/shop/auth/auth-screen";
import { ResetPasswordForm } from "@/components/shop/auth/reset-password-form";

/** Reset password from the emailed link (?token=…). No PNG; Sign_In.png styling. */
export const metadata: Metadata = {
  title: "Reset Password",
  // The URL carries a one-time token: never send it to other sites.
  referrer: "no-referrer",
};

export default function ResetPasswordPage() {
  return (
    <PageTransition>
      <AuthScreen crumb="Reset Password" title="Reset Password">
        <ResetPasswordForm />
      </AuthScreen>
    </PageTransition>
  );
}
