import type { Metadata } from "next";
import { PageTransition } from "@/components/shared/page-transition";
import { AuthScreen } from "@/components/shop/auth/auth-screen";
import { SignUpForm } from "@/components/shop/auth/sign-up-form";
import { googleEnabled } from "@/lib/config/auth";

/** Create Account (designs/screens/web/Create_Account.png). */
export const metadata: Metadata = { title: "Create Account" };

export default function SignUpPage() {
  return (
    <PageTransition>
      <AuthScreen crumb="Create Account" title="Create Account" subtitle="Save your cart and wishlist, and track every order.">
        <SignUpForm googleEnabled={googleEnabled} />
      </AuthScreen>
    </PageTransition>
  );
}
