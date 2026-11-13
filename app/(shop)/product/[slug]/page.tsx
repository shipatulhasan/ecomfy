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
import { StarRating } from "@/components/shop/star-rating";
import { productCopy } from "@/lib/config/product";
import { shopContent } from "@/lib/config/shop";
import { getProductQuickView } from "@/lib/queries/product";
import { shopHref } from "@/lib/shop-params";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Product page — STUB. Gallery + info (the same shared components as the Quick
 * View) so /product/[slug] links and the /quick/[slug] redirect work. The full PDP
 * (Description / Additional Info / Customer Feedback tabs, related products) is a
 * separate task: designs/screens/web/Products_Details_*.png.
 *
 * Laptop+: gallery 648 | info, as in the PDP PNGs. Below laptop: stacked, and the
 * purchase row is pinned above the tab bar (StickyActionBar).
 */

type Props = PageProps<"/product/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductQuickView(slug);
  if (!product) return { title: productCopy.notFoundTitle };
  return {
    title: product.name,
    description: product.shortDescription ?? undefined,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { images: product.images[0] ? [product.images[0].url] : undefined },
  };
}

const t = shopContent.crumbs;
const baseCrumbs: Crumb[] = [
  { label: t.home, href: "/" },
  { label: t.shop, href: "/shop" },
];

export default function ProductPage({ params }: Props) {
  return (
    <PageTransition>
      <Suspense fallback={<ProductPageSkeleton />}>
        <ProductPageContent slug={params.then((p) => p.slug)} />
      </Suspense>
    </PageTransition>
  );
}

async function ProductPageContent({ slug }: { slug: Promise<string> }) {
  const product = await getProductQuickView(await slug);
  if (!product) notFound();

  const crumbs: Crumb[] = [
    { label: t.home, href: "/" },
    { label: product.category.name, href: shopHref({ category: product.category.slug }) },
    { label: product.name, href: `/product/${product.slug}` },
  ];

  return (
    <ProductPurchaseProvider
      product={{ id: product.id, slug: product.slug, name: product.name }}
      variants={product.variants}
    >
      <PageHero crumbs={crumbs} jsonLd={breadcrumbJsonLd(crumbs, absoluteUrl)} />
      <Container className="pt-4 pb-section tablet:pt-6 laptop:pt-8">
        <div className="flex flex-col gap-6 laptop:grid laptop:grid-cols-2 laptop:gap-6">
          <ProductGallery images={product.images} name={product.name} />
          <ProductInfo product={product} heading="h1" />
        </div>

        {/* Anchor for "N Review" links until the PDP's Customer Feedback tab exists. */}
        <section id="reviews" className="mt-section scroll-mt-(--app-header-h) border-t border-border pt-6">
          <h2 className="text-h3 text-foreground">{productCopy.reviewsTitle}</h2>
          <div className="mt-3 flex items-center gap-2 text-copy text-text-body">
            <StarRating rating={product.ratingAvg} starClassName="size-4.5" />
            {product.ratingAvg.toFixed(1)} · {product.reviewCount} {productCopy.review}
          </div>
        </section>
      </Container>
      <StickyActionBar>
        <PurchaseRow variant="bar" className="w-full" />
      </StickyActionBar>
    </ProductPurchaseProvider>
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
      </Container>
    </>
  );
}
