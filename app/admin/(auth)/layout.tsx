import { AuthHero, Circles } from "@/components/admin/auth/auth-hero";

/**
 * Admin Login / Register / Forgot / Reset password (Login.png, Register.png and
 * the 430 mobile frames):
 * - laptop+: hero panel (86fr) | form column (58fr, at least 28rem) with the card centered;
 * - tablet: the card centered on the green gradient;
 * - mobile: hero card on the gradient, then the form on a white panel (24 padding).
 */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col bg-linear-to-b from-auth-hero-from to-auth-hero-to laptop:grid laptop:grid-cols-[minmax(0,86fr)_minmax(28rem,58fr)] laptop:bg-none laptop:bg-card">
      <Circles className="hidden tablet:block laptop:hidden" />
      <AuthHero />
      <main className="relative flex flex-1 flex-col rounded-t-3xl bg-card px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] tablet:items-center tablet:justify-center tablet:rounded-none tablet:bg-transparent tablet:p-10 laptop:bg-card">
        {children}
      </main>
    </div>
  );
}
