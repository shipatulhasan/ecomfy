import { ChevronRightIcon, HomeIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { Container } from "@/components/shared/container";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { asset } from "@/lib/assets";
import { cn } from "@/lib/utils";

export type Crumb = { label: string; href?: string };

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
  const [home, ...rest] = crumbs;
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
      <Container className="flex h-full items-center">
        <Breadcrumb>
          <BreadcrumbList className="gap-2 text-copy text-muted-foreground tablet:text-lead">
            {home && (
              <BreadcrumbItem>
                <BreadcrumbLink asChild className="tap-target grid place-items-center hover:text-primary-foreground">
                  <Link href={home.href ?? "/"} aria-label={home.label}>
                    <HomeIcon aria-hidden className="size-5 stroke-[1.5] tablet:size-6" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            )}
            {rest.map((c, i) => (
              <Fragment key={`${c.label}-${i}`}>
                <BreadcrumbSeparator className="text-muted-foreground">
                  <ChevronRightIcon />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  {i === rest.length - 1 || !c.href ? (
                    <BreadcrumbPage className="text-primary">{c.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild className="tap-target flex items-center hover:text-primary-foreground">
                      <Link href={c.href}>{c.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </Container>
      {jsonLd && (
        <script
          type="application/ld+json"
          // Escape "<" so a crumb label can't close the script tag (Next.js JSON-LD guide).
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
        />
      )}
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
