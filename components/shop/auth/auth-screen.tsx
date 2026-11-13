import { Container } from "@/components/shared/container";
import { PageHero } from "@/components/shop/page-hero";

/**
 * Sign In / Create Account / Forgot / Reset password frame.
 *
 * - Laptop+ (Sign_In.png, Create_Account.png): breadcrumb band (Account › Login),
 *   then a 520 design-px card (24 padding, 32 bottom), 80 above and below.
 * - Tablet: the same card, centered, without the band.
 * - Mobile: a full-screen app form, no card chrome, with a short subtitle under
 *   the title. The primary button sits in a StickyActionBar (each form). The tab
 *   bar, newsletter band and footer are hidden below laptop on these screens
 *   (`data-app-screen="focus"`, app/globals.css and bottom-nav HIDDEN_ON).
 */
export function AuthScreen({
  crumb,
  title,
  subtitle,
  children,
}: {
  crumb: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div data-app-screen="focus">
      <PageHero
        className="hidden laptop:block"
        crumbs={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: crumb }]}
      />
      <Container className="pt-6 pb-8 tablet:py-16 laptop:py-20">
        <section className="mx-auto w-full tablet:max-w-130 tablet:rounded-lg tablet:bg-card tablet:px-6 tablet:pt-6 tablet:pb-8 tablet:shadow-dropdown">
          <h1 className="text-h1 text-foreground tablet:text-center tablet:text-h2">{title}</h1>
          {subtitle && <p className="mt-1.5 text-copy text-text-subtle laptop:hidden">{subtitle}</p>}
          <div className="mt-6 laptop:mt-5">{children}</div>
        </section>
      </Container>
    </div>
  );
}

/** "Don't have account? Register" row under the auth forms. */
export function AuthSwitch({ prompt, children }: { prompt: string; children: React.ReactNode }) {
  return (
    <p className="mt-6 text-center text-copy text-text-subtle laptop:mt-5">
      {prompt} <span className="font-medium text-foreground">{children}</span>
    </p>
  );
}
