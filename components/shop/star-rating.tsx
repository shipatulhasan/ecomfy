import { StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 5 stars, filled to the rounded rating (warning token = the orange stars in the design). */
export function StarRating({
  rating,
  className,
  starClassName = "size-3",
}: {
  rating: number;
  className?: string;
  starClassName?: string;
}) {
  const filled = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <div role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5`} className={cn("flex gap-px", className)}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          key={i}
          aria-hidden
          className={cn(
            starClassName,
            i < filled ? "fill-warning text-warning" : "fill-muted-foreground/40 text-transparent",
          )}
        />
      ))}
    </div>
  );
}
