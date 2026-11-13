import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CacheTags } from "@/lib/cache-tags";
import { REVIEWS_PAGE_SIZE } from "@/lib/config/product";

/**
 * PDP → Customer Feedback. Public data only (reviewer name + avatar), cached per
 * product and tagged `reviews:{productId}`; submitReview() calls updateTag() on it.
 */
export type ReviewData = {
  id: string;
  name: string;
  image: string | null;
  rating: number;
  body: string;
  /** ISO */
  createdAt: string;
};

export type ReviewPage = { items: ReviewData[]; hasMore: boolean };

export type ReviewStats = { average: number; count: number };

export async function getReviewStats(productId: string): Promise<ReviewStats> {
  "use cache";
  cacheTag(CacheTags.reviews(productId));
  cacheLife("hours");

  const agg = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
    _count: true,
  });
  return { average: Math.round((agg._avg.rating ?? 0) * 10) / 10, count: agg._count };
}

/**
 * Newest first. `pages` > 1 returns pages 1..pages in one list (the server-rendered
 * `?rpage=N` state, so a shared/crawled link shows everything loaded so far).
 */
export async function getReviews(productId: string, page = 1, pages = 1): Promise<ReviewPage> {
  "use cache";
  cacheTag(CacheTags.reviews(productId));
  cacheLife("hours");

  const take = REVIEWS_PAGE_SIZE * pages;
  const rows = await prisma.review.findMany({
    where: { productId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * REVIEWS_PAGE_SIZE,
    take: take + 1, // one extra row tells whether there's another page
    select: {
      id: true,
      rating: true,
      body: true,
      createdAt: true,
      user: { select: { name: true, image: true } },
    },
  });
  return {
    items: rows.slice(0, take).map(toReviewData),
    hasMore: rows.length > take,
  };
}

export function toReviewData(r: {
  id: string;
  rating: number;
  body: string;
  createdAt: Date;
  user: { name: string; image: string | null };
}): ReviewData {
  return {
    id: r.id,
    name: r.user.name,
    image: r.user.image,
    rating: r.rating,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
  };
}
