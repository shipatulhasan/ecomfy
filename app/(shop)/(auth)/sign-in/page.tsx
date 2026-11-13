import type { Metadata } from "next";
import { PageTransition } from "@/components/shared/page-transition";
import { AuthScreen } from "@/components/shop/auth/auth-screen";
import { SignInForm } from "@/components/shop/auth/sign-in-form";
import { googleEnabled } from "@/lib/config/auth";

/** Sign In (designs/screens/web/Sign_In.png). Signed-in visitors are redirected by proxy.ts. */
export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() {
  return (
    <PageTransition>
      <AuthScreen crumb="Login" title="Sign In" subtitle="Welcome back! Sign in to see your orders and checkout faster.">
        <SignInForm googleEnabled={googleEnabled} />
      </AuthScreen>
    </PageTransition>
  );
}
