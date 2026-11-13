import { Suspense } from "react";
import { RouteModal } from "@/components/shared/route-modal";
import { QuickViewContent } from "@/components/shop/quick-view/quick-view-content";
import { QuickViewSkeleton } from "@/components/shop/quick-view/quick-view-skeleton";
import { productCopy } from "@/lib/config/product";

/**
 * Product Quick View, intercepted over the current Shop/Home page when a card's
 * "Quick view" link is followed (soft navigation). The modal shell opens at once and
 * the product streams in behind a skeleton. Hard loads of /quick/[slug] hit
 * app/(shop)/quick/[slug]/page.tsx instead, which redirects to the PDP.
 */
export default function QuickViewModal({ params }: PageProps<"/quick/[slug]">) {
  return (
    <RouteModal title={productCopy.quickView} description={productCopy.quickViewDescription}>
      <Suspense fallback={<QuickViewSkeleton />}>
        <QuickViewContent slug={params.then((p) => p.slug)} />
      </Suspense>
    </RouteModal>
  );
}
