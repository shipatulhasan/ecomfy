import { EyeIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { discountPercent } from "@/lib/money";
import type { ProductCardData } from "@/lib/queries/catalog";
import { AddToCartButton } from "./product/add-to-cart-button";
import { CountdownTimer } from "./countdown-timer";
import { PriceTag } from "./price-tag";
import { ProductBadge } from "./product-badge";
import { StarRating } from "./star-rating";
import { WishlistButton } from "./product/wishlist-button";
import { laptopSizes } from "@/lib/image-sizes";

/**
 * THE product card (Figma "Product 5n" / "Product 4x" / "BIG Products").
 *
 * - default: image, name, price (+ compare-at), stars, round add-to-cart bag;
 *   wishlist + quick view appear top-right on hover (always visible below laptop,
 *   where there is no hover). Quick view opens /quick/[slug], intercepted as a
 *   modal (dialog from laptop, bottom sheet below) over the current page.
 * - spotlight: the large Hot Deals card — action row, centered text, feedback
 *   count and the deal countdown.
 * - framed: "Product 4x" (Shop grid) — same content as default, but a rounded,
 *   standalone card for gapped grids (<ProductGrid borders="gap">).
 * - compact: Shop sidebar "Sale Products" row (312×112) — image left, name /
 *   price / stars right, the whole card is the link.
 *
 * "Out of Stock" is added automatically before any other chip.
 *
 * Server Component; only the buttons are client leaves. The product name is a
 * stretched link (`data-slot="card-link"`), buttons sit above it (z-10), so nothing
 * interactive is nested. Cards have no outer margins: <ProductGrid borders="shared">
 * and <ProductRail> add the shared-border offsets. Below laptop, pressing the card
 * scales it (`press-card`) and opening it slides the PDP in (`nav-forward`).
 * Lay default cards out with <ProductGrid> (shared 1px borders).
 */
export type ProductCardProps = {
  product: ProductCardData;
  variant?: "default" | "spotlight" | "framed" | "compact";
  /** Extra chips after the automatic "Sale N%" (e.g. "Best Sale"). */
  badges?: string[];
  /** next/image sizes; defaults to the Home 2 / 3 / 4 / 5 grid. */
  sizes?: string;
  countdownLabel?: string;
  /** "eager" for above-the-fold cards (first grid row): loads now, high fetch priority. */
  imageLoading?: "eager" | "lazy";
  className?: string;
};

export const PRODUCT_GRID_SIZES = `${laptopSizes(264)}, (width >= 48rem) 33vw, 50vw`;
/** Shop listing: 312 sidebar + 3 × 312 design-px on laptop+; 3 / 2 below. */
export const LISTING_GRID_SIZES = `${laptopSizes(312)}, (width >= 48rem) 33vw, 50vw`;
const SPOTLIGHT_SIZES = `${laptopSizes(528)}, (width >= 48rem) 66vw, 100vw`;

export function ProductCard({
  product,
  variant = "default",
  badges = [],
  sizes,
  countdownLabel = "Hurry up! Offer ends In:",
  imageLoading,
  className,
}: ProductCardProps) {
  const off = discountPercent(product.priceCents, product.compareAtCents);
  const href = `/product/${product.slug}`;
  const spotlight = variant === "spotlight";
  const framed = variant === "framed";
  const eager = imageLoading === "eager";

  if (variant === "compact") return <CompactCard product={product} href={href} className={className} />;

  return (
    <article
      className={cn(
        "group/card press-card relative flex h-full flex-col border border-border bg-card",
        "hover:z-10 hover:border-brand-dark hover:shadow-card-hover focus-within:z-10 focus-within:border-brand-dark",
        framed && "rounded-lg",
        spotlight && "border-brand-dark",
        className,
      )}
    >
      {/* badges */}
      <div className={cn("absolute z-10 flex gap-2", spotlight ? "top-6 left-6" : "top-4 left-4")}>
        {!product.inStock && <ProductBadge tone="dark">Out of Stock</ProductBadge>}
        {off > 0 && <ProductBadge tone="sale">Sale {off}%</ProductBadge>}
        {badges.map((b) => (
          <ProductBadge key={b} tone="info">
            {b}
          </ProductBadge>
        ))}
      </div>

      {/* image */}
      <div className={cn("relative overflow-hidden", spotlight ? "px-6 pt-16" : "p-1.25")}>
        <div
          className={cn(
            "relative w-full transition-[scale] duration-500 ease-out motion-safe:laptop:group-hover/card:scale-[1.04]",
            // framed = Shop.png "Product 4x" (312×407): image box 302×320 (listing/skeletons.tsx matches it)
            spotlight ? "aspect-[480/290]" : framed ? "aspect-[302/320]" : "aspect-[254/240]",
          )}
        >
          {product.image ? (
            <Image
              src={product.image.url}
              alt={product.image.alt}
              fill
              sizes={sizes ?? (spotlight ? SPOTLIGHT_SIZES : framed ? LISTING_GRID_SIZES : PRODUCT_GRID_SIZES)}
              loading={imageLoading}
              fetchPriority={eager ? "high" : undefined}
              className={cn("object-contain", framed && "rounded-t-lg")}
            />
          ) : (
            <div className="size-full bg-muted" aria-hidden />
          )}
        </div>
        {!spotlight && (
          <div
            className={cn(
              // z-10: the slide-in `translate` makes this a stacking context, so it must sit
              // above the stretched card link itself (children's z-10 can't escape it).
              "absolute top-4 right-4 z-10 flex flex-col gap-1.5 transition-[opacity,translate] duration-300 ease-out",
              "laptop:pointer-events-none laptop:opacity-0 laptop:group-hover/card:pointer-events-auto laptop:group-hover/card:opacity-100 laptop:group-focus-within/card:pointer-events-auto laptop:group-focus-within/card:opacity-100",
              // Slide in from the right on hover (laptop+, motion-safe).
              "motion-safe:laptop:translate-x-3 motion-safe:laptop:group-hover/card:translate-x-0 motion-safe:laptop:group-focus-within/card:translate-x-0",
            )}
          >
            <WishlistButton productId={product.id} name={product.name} />
            <QuickViewLink slug={product.slug} name={product.name} />
          </div>
        )}
      </div>

      {spotlight ? (
        <div className="flex flex-1 flex-col items-center gap-4 px-6 pt-2 pb-6 text-center">
          <div className="flex w-full items-center gap-2">
            <WishlistButton productId={product.id} name={product.name} className="size-11.5 border-none bg-muted-strong" />
            <AddToCartButton
              appearance="full"
              variantId={product.variantId}
              name={product.name}
              inStock={product.inStock}
              preview={cartPreview(product)}
            />
            <QuickViewLink slug={product.slug} name={product.name} className="size-11.5 border-none bg-muted-strong" />
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <h3 className="text-h4 font-normal text-brand-dark">
              <Link
                href={href}
                transitionTypes={["nav-forward"]}
                data-slot="card-link"
                className="after:absolute after:inset-0"
              >
                {product.name}
              </Link>
            </h3>
            <PriceTag priceCents={product.priceCents} compareAtCents={product.compareAtCents} size="lg" />
            <div className="flex items-center gap-1">
              <StarRating rating={product.ratingAvg} starClassName="size-4.5" />
              <span className="text-caption text-muted-foreground">({product.reviewCount} Feedback)</span>
            </div>
          </div>
          {product.dealEndsAt && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-copy text-muted-foreground">{countdownLabel}</p>
              <CountdownTimer endsAt={product.dealEndsAt} size="sm" />
            </div>
          )}
        </div>
      ) : (
        <div className={cn("flex items-center gap-2", framed ? "px-3 pb-4 tablet:px-4 tablet:pb-5" : "px-3 pb-3")}>
          <div className="flex min-w-0 flex-1 flex-col">
            <h3 className="truncate text-copy text-text-body transition-colors group-hover/card:text-brand-dark">
              <Link
                href={href}
                transitionTypes={["nav-forward"]}
                data-slot="card-link"
                className="after:absolute after:inset-0 focus-visible:outline-none"
              >
                {product.name}
              </Link>
            </h3>
            <PriceTag priceCents={product.priceCents} compareAtCents={product.compareAtCents} />
            <StarRating rating={product.ratingAvg} className="mt-1.5" />
          </div>
          <AddToCartButton
            variantId={product.variantId}
            name={product.name}
            inStock={product.inStock}
            preview={cartPreview(product)}
          />
        </div>
      )}
    </article>
  );
}

/** Mini-cart row data for an add from this card (shown before the server answers). */
const cartPreview = (p: ProductCardData) => ({
  productId: p.id,
  slug: p.slug,
  name: p.name,
  variantName: p.variantName,
  image: p.image ? { url: p.image.url, alt: p.image.alt } : null,
  unitCents: p.priceCents,
  compareAtCents: p.compareAtCents,
  stock: p.stock,
});

/** Shop sidebar "Sale Products" row (Figma "Product" 312×112). */
function CompactCard({ product, href, className }: { product: ProductCardData; href: string; className?: string }) {
  return (
    <article
      className={cn(
        "group/card press-card relative flex items-center gap-1.5 rounded-lg border border-border bg-card p-2 pr-4",
        "hover:border-brand-dark hover:shadow-card-hover focus-within:border-brand-dark",
        className,
      )}
    >
      <div className="relative size-24 shrink-0">
        {product.image ? (
          <Image src={product.image.url} alt={product.image.alt} fill sizes="96px" className="object-contain" />
        ) : (
          <div className="size-full rounded-md bg-muted" aria-hidden />
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <h3 className="truncate text-copy text-text-body transition-colors group-hover/card:text-brand-dark">
          <Link
            href={href}
            transitionTypes={["nav-forward"]}
            data-slot="card-link"
            className="after:absolute after:inset-0 focus-visible:outline-none"
          >
            {product.name}
          </Link>
        </h3>
        <PriceTag priceCents={product.priceCents} compareAtCents={product.compareAtCents} />
        <StarRating rating={product.ratingAvg} className="mt-1" />
      </div>
    </article>
  );
}

/**
 * Eye button → /quick/[slug], intercepted by app/(shop)/@modal/(.)quick/[slug] as
 * the Quick View modal. Fully prefetched (shell + cached product) so it opens at
 * once; no scroll reset and no page transition, since the page stays put.
 */
function QuickViewLink({ slug, name, className }: { slug: string; name: string; className?: string }) {
  return (
    <Link
      href={`/quick/${slug}`}
      prefetch
      scroll={false}
      aria-label={`Quick view ${name}`}
      className={cn(
        "press relative z-10 grid size-10 shrink-0 place-items-center rounded-full border border-muted bg-background text-foreground tap-target hover:bg-primary hover:text-primary-foreground",
        className,
      )}
    >
      <EyeIcon aria-hidden className="size-5" />
    </Link>
  );
}
