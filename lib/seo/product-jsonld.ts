import type { ProductPageData } from "@/lib/queries/product";
import type { ReviewData, ReviewStats } from "@/lib/queries/reviews";

/**
 * schema.org Product for the PDP: offers (default variant, or an AggregateOffer
 * across variants), aggregateRating and a few reviews. Rendered as
 * application/ld+json by the page. `abs` makes site-relative URLs absolute.
 */
export function productJsonLd(
  product: ProductPageData,
  stats: ReviewStats,
  reviews: ReviewData[],
  abs: (path: string) => string,
) {
  const url = abs(`/product/${product.slug}`);
  const prices = product.variants.map((v) => v.priceCents / 100);
  const availability = (inStock: boolean) => `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`;
  const main = product.variants[0]!;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    url,
    sku: main.sku,
    description: product.shortDescription ?? product.descriptionText.slice(0, 300),
    image: product.images.map((i) => abs(i.url)),
    category: product.category.name,
    ...(product.brand && { brand: { "@type": "Brand", name: product.brand } }),
    offers:
      product.variants.length > 1
        ? {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: Math.min(...prices).toFixed(2),
            highPrice: Math.max(...prices).toFixed(2),
            offerCount: product.variants.length,
            availability: availability(product.totalStock > 0),
            url,
          }
        : {
            "@type": "Offer",
            priceCurrency: "USD",
            price: (main.priceCents / 100).toFixed(2),
            availability: availability(main.stock > 0),
            itemCondition: "https://schema.org/NewCondition",
            url,
          },
    ...(stats.count > 0 && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: stats.average,
        reviewCount: stats.count,
        bestRating: 5,
        worstRating: 1,
      },
      review: reviews.map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.name },
        datePublished: r.createdAt.slice(0, 10),
        reviewBody: r.body,
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      })),
    }),
  };
}

/** JSON for a <script type="application/ld+json"> (escapes "<" so it can't close the tag). */
export const jsonLdString = (data: object) => JSON.stringify(data).replace(/</g, "\\u003c");
