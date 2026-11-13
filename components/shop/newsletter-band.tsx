import { Container } from "@/components/shared/container";
import { SocialIcon } from "@/components/shared/social-icons";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";
import { NewsletterForm } from "./newsletter-form";

/**
 * Newsletter band above the footer on every shop page.
 * Stacked on mobile/tablet; one row from laptop (designs/DESIGN.md).
 */
export function NewsletterBand() {
  const { newsletter, social } = siteConfig;
  return (
    <section data-slot="newsletter-band" aria-labelledby="newsletter-title" className="bg-muted">
      <Container className="flex flex-col gap-6 py-8 laptop:flex-row laptop:items-center laptop:gap-10 laptop:pt-10 laptop:pb-11.25">
        <div className="laptop:max-w-105 laptop:flex-1">
          <h2 id="newsletter-title" className="text-h3">
            {newsletter.title}
          </h2>
          <p className="mt-1 text-copy text-muted-foreground">{newsletter.description}</p>
        </div>
        <NewsletterForm
          placeholder={newsletter.placeholder}
          cta={newsletter.cta}
          className="-mb-5 laptop:ml-auto laptop:max-w-134"
        />
        <ul className="flex items-center gap-2">
          {social.map((s, i) => (
            <li key={s.network}>
              <a
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className={cn(
                  "grid size-10 place-items-center rounded-full transition-colors tap-target",
                  i === 0
                    ? "bg-primary text-primary-foreground hover:bg-brand-dark"
                    : "text-text-body hover:bg-primary hover:text-primary-foreground",
                )}
              >
                <SocialIcon network={s.network} className="size-4.5" />
              </a>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
