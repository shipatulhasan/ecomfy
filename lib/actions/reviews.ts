"use server";

import { updateTag } from "next/cache";
import { getCurrentUser } from "@/lib/auth-guards";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { getReviews, toReviewData, type ReviewData, type ReviewPage } from "@/lib/queries/reviews";
import { reviewPageSchema, reviewSchema } from "@/lib/validations/product";
import { ActionError, SIGN_IN_REQUIRED, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * PDP → Customer Feedback: any signed-in customer can review a product once
 * (Review @@unique([productId, userId])). The denormalized Product.ratingAvg /
 * reviewCount (card stars, "N Review") are recomputed in the same transaction.
 */
export async function submitReview(input: unknown): Promise<ActionResult<ReviewData>> {
  return runAction(reviewSchema, input, async ({ productId, rating, body }) => {
    // Not requireUser(): a redirect from a client-invoked action would lose the form.
    const user = await getCurrentUser();
    if (!user) throw new ActionError(SIGN_IN_REQUIRED);

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { status: true, slug: true, category: { select: { slug: true } } },
    });
    if (!product || product.status !== "ACTIVE") throw new ActionError("This product is no longer available.");

    let review;
    try {
      review = await prisma.$transaction(async (tx) => {
        const created = await tx.review.create({
          data: { productId, userId: user.id, rating, body },
          select: { id: true, rating: true, body: true, createdAt: true, user: { select: { name: true, image: true } } },
        });
        const agg = await tx.review.aggregate({ where: { productId }, _avg: { rating: true }, _count: true });
        await tx.product.update({
          where: { id: productId },
          data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 10) / 10, reviewCount: agg._count },
        });
        return created;
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ActionError("You've already reviewed this product.");
      }
      throw err;
    }

    // Read-your-own-writes: the review list, the PDP's "N Review" / stars, and cards.
    updateTag(CacheTags.reviews(productId));
    updateTag(CacheTags.product(product.slug));
    updateTag(CacheTags.productsInCategory(product.category.slug));
    updateTag(CacheTags.products);
    return toReviewData(review);
  });
}

/** "Load More" on the Customer Feedback tab. Public, read-only (cached query). */
export async function loadMoreReviews(input: unknown): Promise<ActionResult<ReviewPage>> {
  return runAction(reviewPageSchema, input, ({ productId, page }) => getReviews(productId, page));
}
