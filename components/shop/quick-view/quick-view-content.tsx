import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { getProductQuickView } from "@/lib/queries/product";
import { ProductGallery } from "../product/product-gallery";
import { ProductInfo } from "../product/product-info";
import { ProductPurchaseProvider, PurchaseRow } from "../product/product-purchase";

/**
 * Body of the Quick View modal (designs/screens/web/Product_Quick View.png).
 *
 * - Desktop: the 1320×636 panel: 40 padding, gallery 648 | gap 24 | info 568.
 * - Laptop: the same design scaled by the rem root (82.5rem panel, 40 design-px
 *   padding). The panel is at most 100dvh − 4rem; the gallery stays put and the
 *   info column scrolls inside the panel when it's taller (e.g. 1366×768 fits).
 * - Below laptop: one scroll area (gallery strip, then the info) and a pinned
 *   footer with quantity + Add to Cart + wishlist, clearing the home indicator.
 *
 * Streams inside the modal's <Suspense> (the slug comes from the route params).
 */
export async function QuickViewContent({ slug }: { slug: Promise<string> }) {
  const product = await getProductQuickView(await slug);
  if (!product) notFound();

  return (
    <ProductPurchaseProvider
      product={{ id: product.id, slug: product.slug, name: product.name }}
      variants={product.variants}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain laptop:overflow-hidden">
        <QuickViewLayout
          gallery={<ProductGallery images={product.images} name={product.name} />}
          info={<ProductInfo product={product} className={cn("px-safe-gutter pt-5 pb-6 laptop:p-0", QUICK_VIEW_INFO)} />}
        />
      </div>
      <QuickViewBar>
        <PurchaseRow variant="bar" />
      </QuickViewBar>
    </ProductPurchaseProvider>
  );
}

/** Laptop+: the info column scrolls inside the panel (panel max-h minus 2 × p-10). */
export const QUICK_VIEW_INFO = "laptop:max-h-[calc(100dvh-9rem)] laptop:overflow-y-auto laptop:overscroll-contain";

/** Shared by the content and its skeleton so both have the same geometry. */
export function QuickViewLayout({ gallery, info }: { gallery: React.ReactNode; info: React.ReactNode }) {
  return (
    // 648fr / 568fr: exactly 648 | 568 design-px in the 1320 panel at every laptop+ width.
    <article className="laptop:grid laptop:grid-cols-[minmax(0,648fr)_minmax(0,568fr)] laptop:items-start laptop:gap-6 laptop:p-10">
      {gallery}
      {info}
    </article>
  );
}

export function QuickViewBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="shrink-0 border-t border-border bg-background px-safe-gutter pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] laptop:hidden">
      {children}
    </div>
  );
}
