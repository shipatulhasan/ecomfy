import { productCopy } from "@/lib/config/product";
import { Money } from "@/components/shared/money";
import { discountPercent } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * Quick View / PDP price row: "$48.00 $17.28 [64% Off]". The compare-at price is
 * struck through and muted, the price is brand green, and the % is computed.
 * Presentational (no hooks), so server pages and client leaves both use it.
 */
export function PriceBlock({
  priceCents,
  compareAtCents,
  className,
}: {
  priceCents: number;
  compareAtCents?: number | null;
  className?: string;
}) {
  const off = discountPercent(priceCents, compareAtCents);
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}>
      <p className="flex items-baseline gap-1">
        {off > 0 && compareAtCents && (
          <s className="text-h4 font-normal text-muted-foreground">
            <span className="sr-only">Was </span>
            <Money cents={compareAtCents} />
          </s>
        )}
        <span className="text-h3 font-medium text-brand-dark">
          {off > 0 && <span className="sr-only">Now </span>}
          <Money cents={priceCents} />
        </span>
      </p>
      {off > 0 && (
        <span className="rounded-full bg-sale-soft px-2.5 py-0.75 text-copy font-medium whitespace-nowrap text-sale">
          {off}% {productCopy.off}
        </span>
      )}
    </div>
  );
}
