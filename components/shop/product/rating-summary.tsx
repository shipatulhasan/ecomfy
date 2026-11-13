import Link from "next/link";
import { productCopy } from "@/lib/config/product";
import { cn } from "@/lib/utils";
import { StarRating } from "../star-rating";

/** "★★★★★ 4 Review • SKU: 2,51,594". The review count links to the PDP reviews. */
export function RatingSummary({
  slug,
  rating,
  reviewCount,
  sku,
  className,
}: {
  slug: string;
  rating: number;
  reviewCount: number;
  /** SKU node (client leaf when it follows the selected variant). */
  sku?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-copy", className)}>
      <div className="flex items-center gap-1">
        <StarRating rating={rating} starClassName="size-4.5" />
        <Link
          href={`/product/${slug}#reviews`}
          className="tap-target flex items-center text-text-body hover:text-foreground hover:underline"
        >
          {reviewCount} {productCopy.review}
        </Link>
      </div>
      {sku && (
        <>
          <span aria-hidden className="text-muted-foreground">
            •
          </span>
          {sku}
        </>
      )}
    </div>
  );
}

/** "SKU: 2,51,594". The SKU is an identifier string, shown as stored. */
export function SkuLabel({ sku }: { sku: string }) {
  return (
    <p className="flex gap-1">
      <span className="font-medium text-foreground">{productCopy.sku}</span>
      <span className="text-text-body">{sku}</span>
    </p>
  );
}
