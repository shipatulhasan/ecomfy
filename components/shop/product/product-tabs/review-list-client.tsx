"use client";

import { StarIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { AdaptiveSheet } from "@/components/shared/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { loadMoreReviews, submitReview } from "@/lib/actions/reviews";
import { SIGN_IN_REQUIRED } from "@/lib/actions/result";
import { pdpCopy, productCopy } from "@/lib/config/product";
import type { ReviewData } from "@/lib/queries/reviews";
import { cn } from "@/lib/utils";
import { useShopState } from "../../shop-state";
import { ReviewCard } from "./review-card";
import { ReviewListSkeleton } from "./review-skeleton";

/**
 * Customer Feedback list. The server renders pages 1..?rpage (crawlable, works
 * without JS); this leaf appends further pages through `loadMoreReviews` (no
 * navigation, `?rpage=` kept in sync with replaceState) and inserts a submitted
 * review optimistically. "Load More" is a real link, so it also works before
 * hydration.
 */
export function ReviewList({
  productId,
  productName,
  initialItems,
  initialHasMore,
  nextPage: initialNextPage,
}: {
  productId: string;
  productName: string;
  initialItems: ReviewData[];
  initialHasMore: boolean;
  nextPage: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [nextPage, setNextPage] = useState(initialNextPage);
  const [loading, startLoading] = useTransition();
  const [optimistic, addOptimistic] = useOptimistic(items, (list, review: ReviewData) => [review, ...list]);

  // After submitReview() the route refreshes with fresh server items (updateTag).
  // Merge them with the pages loaded here so nothing already shown disappears.
  const [prevInitial, setPrevInitial] = useState(initialItems);
  if (initialItems !== prevInitial) {
    setPrevInitial(initialItems);
    const seen = new Set(initialItems.map((r) => r.id));
    setItems([...initialItems, ...items.filter((r) => !seen.has(r.id))]);
  }

  function loadMore(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab: follow the link
    e.preventDefault();
    if (loading) return;
    startLoading(async () => {
      const res = await loadMoreReviews({ productId, page: nextPage });
      if (!res.ok) {
        toast.error(pdpCopy.loadMoreError);
        return;
      }
      const seen = new Set(items.map((r) => r.id));
      setItems((prev) => [...prev, ...res.data.items.filter((r) => !seen.has(r.id))]);
      setHasMore(res.data.hasMore);
      setNextPage(nextPage + 1);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "reviews");
      url.searchParams.set("rpage", String(nextPage));
      url.hash = "";
      window.history.replaceState(null, "", url);
    });
  }

  const moreHref = `?tab=reviews&rpage=${nextPage}`;

  return (
    <div className="flex max-w-190 flex-col">
      {optimistic.length === 0 ? (
        <p className="py-6 text-copy text-muted-foreground">{pdpCopy.noReviews}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {optimistic.map((r) => (
            <li key={r.id} className="py-5 first:pt-0">
              <ReviewCard review={r} pending={r.id.startsWith("optimistic:")} />
            </li>
          ))}
        </ul>
      )}
      {loading && <ReviewListSkeleton count={2} />}
      <div className="mt-6 flex flex-wrap items-center gap-3 laptop:mt-1">
        {hasMore && (
          <a
            href={moreHref}
            onClick={loadMore}
            aria-disabled={loading || undefined}
            className="press inline-flex h-11.25 items-center rounded-full bg-secondary px-6 text-copy font-semibold text-primary tap-target transition-colors hover:bg-primary hover:text-primary-foreground aria-disabled:opacity-60"
          >
            {pdpCopy.loadMore}
          </a>
        )}
        <WriteReview
          productId={productId}
          productName={productName}
          onSubmitted={(review) => setItems((prev) => [review, ...prev.filter((r) => r.id !== review.id)])}
          addOptimistic={addOptimistic}
        />
      </div>
    </div>
  );
}

function WriteReview({
  productId,
  productName,
  onSubmitted,
  addOptimistic,
}: {
  productId: string;
  productName: string;
  onSubmitted: (review: ReviewData) => void;
  addOptimistic: (review: ReviewData) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, user } = useShopState();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<{ rating?: string; body?: string }>({});
  const [pending, setPending] = useState(false);

  const promptSignIn = () =>
    toast(pdpCopy.reviewSignIn, {
      id: "review-sign-in",
      action: {
        label: productCopy.signIn,
        onClick: () => router.push(`/sign-in?callbackUrl=${encodeURIComponent(`${pathname}?tab=reviews`)}`),
      },
    });

  function onOpenChange(next: boolean) {
    if (next && ready && !user) return promptSignIn();
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const local = {
      rating: rating < 1 ? "Choose a rating" : undefined,
      body: body.trim().length < 3 ? "Tell us a bit more" : undefined,
    };
    setErrors(local);
    if (local.rating || local.body) return;

    setPending(true);
    setOpen(false);
    startTransition(async () => {
      addOptimistic({
        id: `optimistic:${Date.now()}`,
        name: user?.name ?? "You",
        image: null,
        rating,
        body: body.trim(),
        createdAt: new Date().toISOString(),
      });
      const res = await submitReview({ productId, rating, body });
      setPending(false);
      if (res.ok) {
        startTransition(() => onSubmitted(res.data));
        setRating(0);
        setBody("");
        toast.success(pdpCopy.reviewThanks);
      } else if (res.error === SIGN_IN_REQUIRED) {
        promptSignIn();
      } else {
        setErrors({ rating: res.fieldErrors?.rating?.[0], body: res.fieldErrors?.body?.[0] });
        toast.error(res.error);
        setOpen(true);
      }
    });
  }

  const formId = "write-review-form";

  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={pdpCopy.writeReviewTitle}
      description={pdpCopy.writeReviewDescription(productName)}
      trigger={
        <Button type="button" variant="outline" className="h-11.25 rounded-full px-6" disabled={pending}>
          {pdpCopy.writeReview}
        </Button>
      }
      footer={
        <Button type="submit" form={formId} className="h-12 w-full rounded-full" disabled={pending}>
          {pdpCopy.submitReview}
        </Button>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <fieldset aria-describedby={errors.rating ? "review-rating-error" : undefined}>
          <legend className="mb-2 text-copy font-medium text-foreground">{pdpCopy.ratingLabel}</legend>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="tap-target grid size-10 cursor-pointer place-items-center rounded-full has-focus-visible:ring-2 has-focus-visible:ring-ring">
                <input
                  type="radio"
                  name="rating"
                  value={n}
                  checked={rating === n}
                  onChange={() => setRating(n)}
                  className="sr-only"
                />
                <span className="sr-only">{pdpCopy.ratingOption(n)}</span>
                <StarIcon
                  aria-hidden
                  className={cn("size-7", n <= rating ? "fill-warning text-warning" : "fill-muted text-muted-foreground/50")}
                />
              </label>
            ))}
          </div>
          {errors.rating && (
            <p id="review-rating-error" className="mt-1 text-caption text-destructive">
              {errors.rating}
            </p>
          )}
        </fieldset>
        <div className="flex flex-col gap-2">
          <label htmlFor="review-body" className="text-copy font-medium text-foreground">
            {pdpCopy.bodyLabel}
          </label>
          <Textarea
            id="review-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={pdpCopy.bodyPlaceholder}
            rows={5}
            maxLength={2000}
            aria-invalid={!!errors.body || undefined}
            aria-describedby={errors.body ? "review-body-error" : undefined}
          />
          {errors.body && (
            <p id="review-body-error" className="text-caption text-destructive">
              {errors.body}
            </p>
          )}
        </div>
      </form>
    </AdaptiveSheet>
  );
}
