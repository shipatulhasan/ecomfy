import { cn } from "@/lib/utils";
import { Money } from "@/components/shared/money";

/** "৳14.99 ৳20.99": price + struck-through compare-at (only when it is higher). */
export function PriceTag({
  priceCents,
  compareAtCents,
  size = "default",
  className,
}: {
  priceCents: number;
  compareAtCents?: number | null;
  size?: "default" | "lg";
  className?: string;
}) {
  const onSale = !!compareAtCents && compareAtCents > priceCents;
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-0.5", className)}>
      <span className={cn("font-medium text-foreground", size === "lg" ? "text-h3 font-medium" : "text-lead")}>
        <Money cents={priceCents} />
      </span>
      {onSale && (
        <s className={cn("text-muted-foreground", size === "lg" ? "text-h3 font-normal" : "text-lead")}>
          <span className="sr-only">was </span>
          <Money cents={compareAtCents} />
        </s>
      )}
    </p>
  );
}
