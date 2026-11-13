import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { Logo } from "@/components/shared/logo";
import { siteConfig } from "@/lib/config/site";

/**
 * Dark footer (Figma "Footer"): brand block + 4 link groups, then copyright and
 * payment badges. Laptop+: 5 columns. Tablet: brand full width, groups in 4
 * columns. Mobile: groups 2 × 2; bottom bar stacks.
 */
export function SiteFooter() {
  const { description, phone, email, footerGroups, copyright, paymentBadges } = siteConfig;
  return (
    <footer data-slot="site-footer" className="bg-footer text-footer-muted">
      <Container className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 tablet:grid-cols-4 laptop:grid-cols-[448fr_224fr_225fr_223fr_200fr] laptop:gap-x-0 laptop:py-15">
        <div className="col-span-2 flex flex-col gap-4 tablet:col-span-4 laptop:col-span-1 laptop:pr-28">
          <Logo tone="light" className="self-start" />
          <p className="max-w-84 text-copy">{description}</p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-copy">
            <a
              href={phone.href}
              className="border-b-2 border-primary pb-1.5 font-medium text-footer-foreground hover:text-primary"
            >
              {phone.label}
            </a>
            <span>or</span>
            <a
              href={email.href}
              className="border-b-2 border-primary pb-1.5 font-medium text-footer-foreground hover:text-primary"
            >
              {email.label}
            </a>
          </p>
        </div>
        {footerGroups.map((group) => (
          <nav key={group.title} aria-label={group.title} className="flex flex-col gap-4">
            <h2 className="text-lead font-medium text-footer-foreground">{group.title}</h2>
            <ul className="flex flex-col gap-1 laptop:gap-3">
              {group.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="tap-target flex items-center text-copy transition-colors hover:text-footer-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <Container>
        <div className="flex flex-col items-center gap-4 border-t border-footer-foreground/10 py-6 tablet:flex-row tablet:justify-between">
          <p className="text-copy">{copyright}</p>
          <ul className="flex flex-wrap items-center justify-center gap-2" aria-label="Accepted payment methods">
            {paymentBadges.map((b) => (
              <li key={b.label}>
                <Image
                  src={b.image.url}
                  alt={b.label}
                  width={b.image.width / 2}
                  height={b.image.height / 2}
                  className="h-8 w-auto"
                />
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
