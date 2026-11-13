import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { AccountCrumbs } from "@/components/shop/account/account-crumbs";
import { AccountNav } from "@/components/shop/account/account-nav";
import { VerifiedNotice } from "@/components/shop/account/verified-notice";
import { VerifyEmailBanner } from "@/components/shop/account/verify-email-banner";
import { PageHeroFrame } from "@/components/shop/page-hero";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";

/**
 * Customer account shell (User_Dashboard.png, Order_History.png, Order_Details.png,
 * Settings.png), shared by every /account page.
 *
 * - Laptop+: breadcrumb band (Account › page), then the 312 design-px "Navigation"
 *   card | content (984), 24 apart, 32 under the band and 80 above the newsletter.
 * - Below laptop: no band and no sidebar. The dashboard is the app "profile"
 *   screen with the menu; sub-pages get a back button in the app bar.
 *
 * Access: proxy.ts redirects signed-out visitors; requireUser() below and in every
 * page section (and every action) is the authoritative check.
 */
export const metadata: Metadata = {
  title: { default: "My Account", template: "%s · My Account · Ecofy" },
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHeroFrame className="hidden laptop:block">
        <AccountCrumbs />
      </PageHeroFrame>
      <Container
        data-app-screen="account"
        className="grid gap-6 pt-4 pb-section tablet:pt-6 laptop:grid-cols-[19.5rem_minmax(0,1fr)] laptop:items-start laptop:pt-8 laptop:pb-20">
        <aside className="hidden laptop:block">
          <AccountNav />
        </aside>
        <div className="flex min-w-0 flex-col gap-4 laptop:gap-6">
          <VerifiedNotice />
          <Suspense fallback={null}>
            <EmailBanner />
          </Suspense>
          {children}
        </div>
      </Container>
    </>
  );
}

async function EmailBanner() {
  const user = await requireUser();
  // Read from the DB: the session's cookie cache can lag a just-opened link.
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true, email: true } });
  if (!row || row.emailVerified) return null;
  return <VerifyEmailBanner email={row.email} />;
}
