import { Suspense } from "react";
import { Container } from "@/components/shared/container";
import { cn } from "@/lib/utils";
import { pdpCopy, productHighlights, type PdpTab } from "@/lib/config/product";
import type { ProductPageData } from "@/lib/queries/product";
import { DescriptionPanel } from "./description-panel";
import { HighlightBox } from "./highlight-box";
import { PdpTabs } from "./pdp-tabs";
import { ProductVideo } from "./product-video";
import { ReviewsPanel } from "./reviews-panel";
import { ReviewListSkeleton } from "./review-skeleton";
import { SpecTable } from "./spec-table";
import { TabSplit } from "./tab-split";
import { PDP_TABS_ID } from "./tab-events";

/**
 * PDP tabs (designs/screens/web/Products_Details_*.png, Product_Detail_Customer_Feedback.png).
 * All three panels are rendered here on the server; <PdpTabs> only switches which
 * one is visible. The nav is full-bleed (its border spans the page), and the
 * panels sit in the page container. Reviews stream in their own Suspense.
 */
export function ProductTabs({
  product,
  tab,
  rpage,
  className,
}: {
  product: ProductPageData;
  tab: PdpTab;
  rpage: number;
  className?: string;
}) {
  const shown = product.variants[0]!;
  const highlights = productHighlights({
    priceCents: shown.priceCents,
    compareAtCents: shown.compareAtCents,
    productType: product.productType,
    categoryName: product.category.name,
  });
  // Descriptions and Additional Information share the video + highlights column.
  const aside =
    product.videoPosterUrl || highlights.length > 0 ? (
      <>
        {product.videoPosterUrl && (
          <ProductVideo name={product.name} posterUrl={product.videoPosterUrl} videoUrl={product.videoUrl} />
        )}
        <HighlightBox items={highlights} />
      </>
    ) : null;

  return (
    <section
      id={PDP_TABS_ID}
      aria-label={pdpCopy.tabsLabel}
      // --pdp-scroll: read by ReviewsLink (smooth only when motion is allowed).
      className={cn("scroll-mt-(--app-header-h) [--pdp-scroll:auto] motion-safe:[--pdp-scroll:smooth]", className)}
    >
      <PdpTabs
        initialTab={tab}
        reviewCount={product.reviewCount}
        panels={{
          description: (
            <Container>
              <TabSplit main={<DescriptionPanel html={product.descriptionHtml} />} aside={aside} />
            </Container>
          ),
          "additional-info": (
            <Container>
              <TabSplit main={<SpecTable product={product} />} aside={aside} />
            </Container>
          ),
          reviews: (
            <Container>
              <Suspense fallback={<ReviewListSkeleton />}>
                <ReviewsPanel productId={product.id} productName={product.name} rpage={rpage} />
              </Suspense>
            </Container>
          ),
        }}
      />
    </section>
  );
}
