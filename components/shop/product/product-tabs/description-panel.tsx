/**
 * Descriptions tab body: the product's sanitized description HTML (bold, links,
 * paragraphs, and the green-check feature list, styled by `product-prose`).
 */
export function DescriptionPanel({ html }: { html: string }) {
  // Sanitized by getProductPage() (lib/rich-text.ts) before it reaches here.
  return <div className="product-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
