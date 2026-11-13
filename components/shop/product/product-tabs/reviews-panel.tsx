import { pdpCopy } from "@/lib/config/product";
import { getReviews } from "@/lib/queries/reviews";
import { ReviewList } from "./review-list-client";

/**
 * Customer Feedback tab body. Streams in its own <Suspense> (ReviewListSkeleton),
 * so the rest of the PDP doesn't wait for it. `rpage` > 1 server-renders every
 * page up to it (a shared "?rpage=3" link shows what was loaded).
 */
export async function ReviewsPanel({
  productId,
  productName,
  rpage,
}: {
  productId: string;
  productName: string;
  rpage: number;
}) {
  const { items, hasMore } = await getReviews(productId, 1, rpage);
  return (
    <div className="pt-6 laptop:pt-8">
      <h2 className="sr-only">{pdpCopy.tabs.reviews.label}</h2>
      <ReviewList
        productId={productId}
        productName={productName}
        initialItems={items}
        initialHasMore={hasMore}
        nextPage={rpage + 1}
      />
    </div>
  );
}
