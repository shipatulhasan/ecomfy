import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { PageTransition } from "@/components/shared/page-transition";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { breadcrumbJsonLd, PageHero, type Crumb } from "@/components/shop/page-hero";
import { ProductGallery } from "@/components/shop/product/product-gallery";
import { ProductInfo } from "@/components/shop/product/product-info";
import { ProductPurchaseProvider, PurchaseRow } from "@/components/shop/product/product-purchase";
import { ProductTabs } from "@/components/shop/product/product-tabs/product-tabs";
import { RelatedProducts, RelatedProductsSkeleton } from "@/components/shop/product/related-products";
import { parsePdpTab, parseReviewPage, productCopy } from "@/lib/config/product";
import { shopContent } from "@/lib/config/shop";
import { getProductPage, type ProductPageData } from "@/lib/queries/product";
import { getReviews, getReviewStats } from "@/lib/queries/reviews";
import { jsonLdString, productJsonLd } from "@/lib/seo/product-jsonld";
import { shopHref } from "@/lib/shop-params";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Product Detail page (designs/screens/web/Products_Details_Description.png,
 * Products_Details_Additional Info.png, Product_Detail_Customer_Feedback.png):
 * one page, the three PNGs are its three tabs.
 *
 * - Laptop+: gallery 648 | info 648, then the full-bleed tab nav, the active
 *   panel, and Related Products, as in the PNGs (scaled by the rem root).
 * - Below laptop: stacked; the tab bar is a sticky segmented control under the
 *   compact header, and the purchase row is pinned above the tab bar
 *   (StickyActionBar).
 *
 * `?tab=` picks the open tab (all panels are server-rendered; the client only
 * switches between them). `?rpage=` server-renders that many review pages. The
 * canonical URL has neither.
 */

type Props = PageProps<"/product/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductPage(slug);
  if (!product) return { title: productCopy.notFoundTitle };
  const description = product.shortDescription ?? product.descriptionText.slice(0, 160);
  const url = `/product/${product.slug}`;
  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      title: product.name,
      description,
      url,
      images: product.images[0] ? [{ url: product.images[0].url, width: product.images[0].width, height: product.images[0].height, alt: product.name }] : undefined,
    },
  };
}

const t = shopContent.crumbs;
const baseCrumbs: Crumb[] = [
  { label: t.home, href: "/" },
  { label: t.shop, href: "/shop" },
];

export default function ProductPage({ params, searchParams }: Props) {
  return (
    <PageTransition>
      <Suspense fallback={<ProductPageSkeleton />}>
        <ProductPageContent slug={params.then((p) => p.slug)} searchParams={searchParams} />
      </Suspense>
    </PageTransition>
  );
}

async function ProductPageContent({
  slug,
  searchParams,
}: {
  slug: Promise<string>;
  searchParams: Props["searchParams"];
}) {
  const [product, query] = await Promise.all([slug.then(getProductPage), searchParams]);
  if (!product) notFound();
  const tab = parsePdpTab(query.tab);
  const rpage = parseReviewPage(query.rpage);

  const crumbs: Crumb[] = [
    { label: t.home, href: "/" },
    { label: product.category.name, href: shopHref({ category: product.category.slug }) },
    { label: product.name, href: `/product/${product.slug}` },
  ];

  return (
    <ProductPurchaseProvider
      product={{ id: product.id, slug: product.slug, name: product.name, image: product.images[0] ?? null }}
      variants={product.variants}
    >
      <PageHero crumbs={crumbs} jsonLd={breadcrumbJsonLd(crumbs, absoluteUrl)} />
      <Suspense>
        <ProductJsonLd product={product} />
      </Suspense>
      <Container className="pt-4 tablet:pt-6 laptop:pt-8">
        <div className="flex flex-col gap-6 laptop:grid laptop:grid-cols-2 laptop:gap-6">
          <ProductGallery images={product.images} name={product.name} />
          <ProductInfo product={product} heading="h1" />
        </div>
      </Container>

      <ProductTabs product={product} tab={tab} rpage={rpage} className="mt-8 laptop:mt-0" />

      <Container className="mt-section pb-section laptop:mt-20">
        <Suspense fallback={<RelatedProductsSkeleton />}>
          <RelatedProducts productId={product.id} categorySlug={product.category.slug} />
        </Suspense>
      </Container>
      <StickyActionBar>
        <PurchaseRow variant="bar" className="w-full" />
      </StickyActionBar>
    </ProductPurchaseProvider>
  );
}

/** Product structured data (offers, aggregateRating, the newest reviews). */
async function ProductJsonLd({ product }: { product: ProductPageData }) {
  const [stats, reviews] = await Promise.all([getReviewStats(product.id), getReviews(product.id)]);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonLdString(productJsonLd(product, stats, reviews.items.slice(0, 3), absoluteUrl)) }}
    />
  );
}

function ProductPageSkeleton() {
  return (
    <>
      <PageHero crumbs={baseCrumbs} />
      <Container className="pt-4 pb-section tablet:pt-6 laptop:pt-8" aria-busy="true">
        <div className="flex flex-col gap-6 laptop:grid laptop:grid-cols-2">
          <Skeleton className="aspect-square w-full laptop:h-139" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-10 w-3/5" />
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-9 w-56" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
        <Skeleton className="mx-auto mt-10 h-10 w-full laptop:w-136" />
      </Container>
    </>
  );
}
