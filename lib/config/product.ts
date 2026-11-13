/**
 * Product detail copy and rules shared by the Quick View and the PDP
 * (designs/screens/web/Product_Quick View.png, Products_Details_*.png).
 */
import { asset, type Asset } from "@/lib/assets";

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
