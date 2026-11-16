import { notFound } from "next/navigation";

/**
 * Fallback for the storefront's `children` slot. The @modal slot's root catch-all
 * (`@modal/[...catchAll]`, which clears Quick View on navigation) attaches to every
 * URL, including ones outside the storefront (/admin/**, the (print) invoice).
 * Next.js strict route matching needs a default for the sibling `children` slot to
 * keep those routes; it behaves exactly like the built-in default (a 404) and never
 * renders for real pages, which always match their own page.
 */
export default function ShopChildrenDefault() {
  notFound();
}
