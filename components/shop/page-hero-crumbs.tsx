import { ChevronRightIcon, HomeIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export type Crumb = { label: string; href?: string };

/**
 * Breadcrumb trail inside the PageHero band: home icon › crumbs, the last one in
 * primary. Plain markup (no hooks, no server-only imports), so client components
 * can render it too.
 */
export function PageHeroCrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const [home, ...rest] = crumbs;
  return (
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
  );
}
