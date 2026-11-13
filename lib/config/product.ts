/**
 * Product detail copy and rules shared by the Quick View and the PDP
 * (designs/screens/web/Product_Quick View.png, Products_Details_*.png).
 */
import { asset, type Asset } from "@/lib/assets";
import { discountPercent } from "@/lib/money";

/** Most units of one variant a single add can request (the stepper also caps at stock). */
export const MAX_CART_QTY = 99;

/** At or below this many units the badge reads "Only N left" instead of "In Stock". */
export const LOW_STOCK_THRESHOLD = 10;

export type StockStatus = "in" | "low" | "out";

export function stockStatus(stock: number): StockStatus {
  if (stock <= 0) return "out";
  return stock <= LOW_STOCK_THRESHOLD ? "low" : "in";
}

/** Brand name (Product.brand) → logo tile. Brands without a logo render their name. */
const brandLogos: Record<string, Asset> = {
  Farmary: asset("brands", "farmary"),
};

export const brandLogo = (brand: string | null): Asset | null => (brand ? (brandLogos[brand] ?? null) : null);

export const productCopy = {
  quickView: "Quick view",
  quickViewDescription: "Product details, options and add to cart.",
  close: "Close",
  inStock: "In Stock",
  lowStock: (n: number) => `Only ${n} left`,
  outOfStock: "Out of Stock",
  review: "Review", // "4 Review" (as in the design)
  sku: "SKU:",
  off: "Off", // "64% Off"
  brand: "Brand:",
  share: "Share item:",
  shareNative: "Share",
  linkCopied: "Link copied. Paste it into Instagram to share.",
  category: "Category:",
  tag: "Tag:",
  option: "Option",
  chooseOption: "Choose an option",
  selectOption: "Select option", // Add to Cart label until an option is chosen (short: fits 320px)
  addToCart: "Add to Cart",
  added: "Added",
  outOfStockButton: "Out of Stock",
  wishlistSignIn: "Sign in to save items to your wishlist.",
  signIn: "Sign in",
  notFoundTitle: "This product isn't available",
  notFoundBody: "It may have been removed or is no longer for sale.",
  backToShop: "Back to shop",
  reviewsTitle: "Customer Feedback",
} as const;

// ───────────────────────── PDP tabs ─────────────────────────

/** `?tab=` values, in tab order. The first is the default (and is dropped from the URL). */
export const PDP_TABS = ["description", "additional-info", "reviews"] as const;
export type PdpTab = (typeof PDP_TABS)[number];

export const parsePdpTab = (v: unknown): PdpTab =>
  typeof v === "string" && (PDP_TABS as readonly string[]).includes(v) ? (v as PdpTab) : "description";

/** Reviews per "Load More" page (`?rpage=`); the design shows 4. */
export const REVIEWS_PAGE_SIZE = 4;
/** Highest `?rpage=` the server renders in one response. */
export const MAX_REVIEW_PAGES = 20;

export const parseReviewPage = (v: unknown): number => {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_REVIEW_PAGES) : 1;
};

export const pdpCopy = {
  /** Laptop+ labels (as in the PNGs) and the shorter segmented-control labels below laptop. */
  tabs: {
    description: { label: "Descriptions", short: "Description" },
    "additional-info": { label: "Additional Information", short: "Info" },
    reviews: { label: "Customer Feedback", short: "Reviews" },
  } satisfies Record<PdpTab, { label: string; short: string }>,
  tabsLabel: "Product information",
  specs: {
    category: "Category:",
    stockStatus: "Stock Status:",
    tags: "Tags:",
    available: "Available",
    outOfStock: "Out of Stock",
  },
  playVideo: "Play product video",
  videoTitle: (name: string) => `${name} video`,
  loadMore: "Load More",
  writeReview: "Write a review",
  writeReviewTitle: "Write a review",
  writeReviewDescription: (name: string) => `Share what you think of ${name}.`,
  ratingLabel: "Your rating",
  ratingOption: (n: number) => `${n} star${n === 1 ? "" : "s"}`,
  bodyLabel: "Your review",
  bodyPlaceholder: "What did you like or dislike?",
  submitReview: "Submit review",
  reviewThanks: "Thanks! Your review is live.",
  reviewSignIn: "Sign in to write a review.",
  noReviews: "No reviews yet. Be the first to share your thoughts.",
  loadMoreError: "Couldn't load more reviews.",
  relatedTitle: "Related Products",
} as const;

/**
 * Highlight boxes beside the video (PNG: "64% Discount / Save your 64% money with
 * us", "100% Organic / 100% Organic Vegetables"). Built from product fields, so a
 * product without a discount or that isn't organic simply shows fewer boxes.
 */
export type HighlightIcon = "discount" | "organic";
export type Highlight = { icon: HighlightIcon; title: string; text: string };

export const highlightIcons: Record<HighlightIcon, Asset> = {
  discount: asset("icons", "pdp-discount"),
  organic: asset("icons", "pdp-organic"),
};

export function productHighlights(p: {
  priceCents: number;
  compareAtCents: number | null;
  productType: string | null;
  categoryName: string;
}): Highlight[] {
  const out: Highlight[] = [];
  const off = discountPercent(p.priceCents, p.compareAtCents);
  if (off > 0) out.push({ icon: "discount", title: `${off}% Discount`, text: `Save your ${off}% money with us` });
  if (p.productType?.toLowerCase() === "organic") {
    out.push({ icon: "organic", title: "100% Organic", text: `100% Organic ${p.categoryName.replace(/^Fresh\s+/i, "")}` });
  }
  return out;
}
