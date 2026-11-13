import Image from "next/image";
import { Container } from "@/components/shared/container";
import { asset } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { PageHeroCrumbs, type Crumb } from "./page-hero-crumbs";

export type { Crumb } from "./page-hero-crumbs";

const background = asset("banners", "breadcrumb-bg");

/**
 * Breadcrumb band under the header on inner storefront pages (Figma "Breadcrumbs"
 * 1920×120): dark produce photo, home icon › crumbs, the current page in primary.
 * 80 / 100 / 120 high (designs/DESIGN.md). The first crumb is shown as the home icon.
 * Pass `jsonLd` (a ready BreadcrumbList object) to emit structured data with it.
 */
export function PageHero({
  crumbs,
  jsonLd,
  className,
}: {
  crumbs: Crumb[];
  jsonLd?: object;
  className?: string;
}) {
  return (
    <PageHeroFrame className={className}>
      <PageHeroCrumbs crumbs={crumbs} />
      {jsonLd && (
        <script
          type="application/ld+json"
          // Escape "<" so a crumb label can't close the script tag (Next.js JSON-LD guide).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
    </PageHeroFrame>
  );
}

/**
 * The band without crumbs, for layouts whose crumbs depend on the page
 * (account area: components/shop/account/account-hero.tsx).
 */
export function PageHeroFrame({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative isolate h-20 overflow-hidden bg-footer tablet:h-25 laptop:h-30", className)}>
      <Image
        src={background.url}
        alt=""
        fill
        preload
        sizes="100vw"
        className="-z-10 object-cover object-left" // dark texture on the left keeps the crumbs legible at every width
      />
      <Container className="flex h-full items-center">{children}</Container>
    </div>
  );
}

/** schema.org BreadcrumbList from crumbs + an absolute-URL resolver. */
export function breadcrumbJsonLd(crumbs: Crumb[], toAbsolute: (path: string) => string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href && { item: toAbsolute(c.href) }),
    })),
  };
}
