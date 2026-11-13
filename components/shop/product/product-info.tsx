import { Separator } from "@/components/ui/separator";
import type { ProductDetail } from "@/lib/queries/product";
import { absoluteUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import { BrandTile } from "./brand-tile";
import { ProductMeta } from "./product-meta";
import { PurchaseRow, SelectedPrice, SelectedSku, SelectedStock, VariantPicker } from "./product-purchase";
import { RatingSummary } from "./rating-summary";
import { ShareButtons } from "./share-buttons";

/**
 * Right-hand info column of the Quick View and the PDP (Figma "Frame 224", 568 wide
 * in the Quick View). Server Component: only the leaves that follow the selected
 * variant are client components (via <ProductPurchaseProvider>, which the caller
 * renders around this column and the mobile action bar).
 *
 * Laptop+ shows the purchase row inline between the dividers. Below laptop the row
 * lives in the caller's pinned bar, so the CTA block holds only the variant picker
 * (and disappears for single-variant products).
 */
export function ProductInfo({
  product,
  heading: Heading = "h2",
  className,
}: {
  product: ProductDetail;
  /** h1 on the PDP, h2 inside the modal. */
  heading?: "h1" | "h2";
  className?: string;
}) {
  const multi = product.variants.length > 1;
  const url = absoluteUrl(`/product/${product.slug}`);
  const image = product.images[0] ? absoluteUrl(product.images[0].url) : undefined;

  return (
    <div className={cn("flex min-w-0 flex-col", className)}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <Heading className="text-h1 text-foreground">{product.name}</Heading>
        <SelectedStock />
      </div>
      <RatingSummary
        slug={product.slug}
        rating={product.ratingAvg}
        reviewCount={product.reviewCount}
        sku={<SelectedSku />}
        className="mt-2 laptop:mt-3"
      />
      <SelectedPrice className="mt-4 laptop:mt-5" />

      <Separator className="mt-5" />

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 laptop:mt-6">
        {product.brand && <BrandTile brand={product.brand} logo={product.brandLogo} />}
        <ShareButtons url={url} title={product.name} image={image} />
      </div>
      {product.shortDescription && (
        <p className="mt-4 text-copy text-muted-foreground">{product.shortDescription}</p>
      )}

      <div
        className={cn(
          "mt-6 flex-col gap-4 border-y border-border py-4.5",
          multi ? "flex" : "hidden laptop:flex",
        )}
      >
        <VariantPicker />
        <PurchaseRow className="hidden laptop:flex" />
      </div>

      <ProductMeta category={product.category} tags={product.tags} className="mt-5 laptop:mt-6" />
    </div>
  );
}
