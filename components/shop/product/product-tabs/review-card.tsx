import { UserIcon } from "lucide-react";
import Image from "next/image";
import { StarRating } from "@/components/shop/star-rating";
import type { ReviewData } from "@/lib/queries/reviews";
import { cn } from "@/lib/utils";
import { RelativeTime } from "./relative-time";

/**
 * One review (PNG "Review", 760 wide): 41 avatar, name + 16px stars, the date on
 * the right, the text 12 under the header. Rows are separated by the list's
 * dividers. Below laptop the date moves under the name (compact card) and long
 * reviews clamp to 4 lines.
 */
export function ReviewCard({ review, pending, className }: { review: ReviewData; pending?: boolean; className?: string }) {
  return (
    <article className={cn("flex flex-col gap-3", pending && "opacity-60", className)} aria-busy={pending || undefined}>
      <header className="flex items-center gap-3">
        <span className="relative grid size-10.25 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground">
          {review.image ? (
            <Image src={review.image} alt="" fill sizes="42px" className="object-cover" />
          ) : (
            <UserIcon aria-hidden className="size-5" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 laptop:flex-row laptop:items-center laptop:justify-between">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="truncate text-copy font-medium text-foreground">{review.name}</h3>
            <StarRating rating={review.rating} starClassName="size-3.5 laptop:size-4" />
          </div>
          <RelativeTime iso={review.createdAt} className="text-caption text-muted-foreground laptop:text-copy" />
        </div>
      </header>
      <p className="line-clamp-4 text-copy text-text-body laptop:line-clamp-none">{review.body}</p>
    </article>
  );
}
