import type { Metadata } from "next";

/**
 * Sign In / Create Account / Forgot + Reset password. Inside the storefront layout
 * (header, newsletter, footer as in the PNGs; the cart store stays mounted). The
 * screen frame is components/shop/auth/auth-screen.tsx. Never indexed.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
