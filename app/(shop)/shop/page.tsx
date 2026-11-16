import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { PageTransition } from "@/components/shared/page-transition";
import { FilterPanel } from "@/components/shop/listing/filter-panel";
import { ShopAside } from "@/components/shop/listing/shop-aside";
import { ShopMain } from "@/components/shop/listing/shop-main";
import { ShopShell } from "@/components/shop/listing/shop-shell";
import { FilterPanelSkeleton, ShopMainSkeleton } from "@/components/shop/listing/skeletons";
import { breadcrumbJsonLd, PageHero, type Crumb } from "@/components/shop/page-hero";
import { shopContent } from "@/lib/config/shop";
import { getCategoryBySlug, getCategorySlugRedirect } from "@/lib/queries/products";
import { shopHref } from "@/lib/shop-params";
import { absoluteUrl } from "@/lib/site-url";
import { parseShopParams } from "@/lib/validations/shop";

/**
 * Shop / product listing (designs/screens/web/Shop.png). The URL is the source of
 * truth: /shop?category=…&min=…&max=…&rating=…&tag=…&brand=…&stock=in&sort=…&page=…
 *
 * Static shell: breadcrumb band, layout, sidebar skeleton. The filter options and
 * the results stream in; filtering, sorting and paging run in Postgres
 * (lib/queries/products.ts).
 */

type Props = PageProps<"/shop">;

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { filters } = parseShopParams(await searchParams);
  const category = filters.category ? await getCategoryBySlug(filters.category) : null;
  if (filters.category && !category) {
    // Renamed category (soft navigation; page loads get a 308 from proxy.ts).
    const moved = await getCategorySlugRedirect(filters.category);
    if (moved) permanentRedirect(shopHref({ ...filters, category: moved, page: undefined }));
    notFound();
  }

  const title = category ? category.seoTitle || category.name : filters.q ? `Search: ${filters.q}` : shopContent.title;
  return {
    title,
    // Admin → Categories SEO fields, then the description, then a default.
    description: category
      ? category.seoDescription || category.description || `Shop ${category.name.toLowerCase()} at Ecofy: fresh, organic and delivered fast.`
      : shopContent.description,
    // Canonical keeps only the category: sort, page and the other facets are views of it.
    alternates: { canonical: shopHref({ category: category?.slug }) },
    // Search result pages shouldn't be indexed.
    ...(filters.q && { robots: { index: false, follow: true } }),
  };
}

const t = shopContent.crumbs;
const shopCrumbs: Crumb[] = [
  { label: t.home, href: "/" },
  { label: t.shop, href: "/shop" },
];

export default function ShopPage({ searchParams }: Props) {
  return (
    <PageTransition>
      <Suspense fallback={<PageHero crumbs={shopCrumbs} />}>
        <ShopHero searchParams={searchParams} />
      </Suspense>
      <Container className="pt-4 pb-section tablet:pt-6 laptop:pt-8 laptop:pb-20">
        <h1 className="sr-only">{shopContent.title}</h1>
        <ShopShell
          sidebar={
            <>
              <Suspense fallback={<FilterPanelSkeleton />}>
                <FilterPanel />
              </Suspense>
              <ShopAside />
            </>
          }
        >
          <Suspense fallback={<ShopMainSkeleton />}>
            <ShopMain searchParams={searchParams} />
          </Suspense>
        </ShopShell>
      </Container>
    </PageTransition>
  );
}

/** Breadcrumb band for the active category (Home › Categories › Vegetables) + JSON-LD. */
async function ShopHero({ searchParams }: Pick<Props, "searchParams">) {
  const { filters } = parseShopParams(await searchParams);
  const category = filters.category ? await getCategoryBySlug(filters.category) : null;
  const crumbs: Crumb[] = category
    ? [
        { label: t.home, href: "/" },
        { label: t.categories, href: "/shop" },
        { label: category.name, href: shopHref({ category: category.slug }) },
      ]
    : shopCrumbs;
  return <PageHero crumbs={crumbs} jsonLd={breadcrumbJsonLd(crumbs, absoluteUrl)} />;
}
