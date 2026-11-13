/**
 * Cart, mini cart and wishlist rules + copy
 * (designs/screens/web/Shopping_Card_Popup.png, Shopping_Cart.png, Wishlist.png).
 */

/** Flat shipping. The design shows "Shipping: Free" on every cart. */
export const SHIPPING_CENTS = 0;

/** Quantity stepper on /cart: wait this long after the last tap before saving. */
export const QUANTITY_DEBOUNCE_MS = 400;

/** Guests keep at most this many wishlist items (cookie size). */
export const MAX_GUEST_WISHLIST = 100;

export const cartCopy = {
  drawerTitle: (n: number) => `Shopping Cart (${n})`,
  drawerDescription: "Items in your cart",
  productCount: (n: number) => `${n} Product${n === 1 ? "" : "s"}`,
  checkout: "Checkout",
  goToCart: "Go To Cart",
  emptyTitle: "Your cart is empty",
  emptyBody: "Looks like you haven't added anything yet.",
  continueShopping: "Continue shopping",
  pageTitle: "My Shopping Cart",
  crumb: "Shopping cart",
  product: "Product",
  price: "Price",
  quantity: "Quantity",
  subtotal: "Subtotal",
  returnToShop: "Return to shop",
  updateCart: "Update Cart",
  updated: "Cart updated",
  couponTitle: "Coupon Code",
  couponMobile: "Have a coupon?",
  couponPlaceholder: "Enter code",
  applyCoupon: "Apply Coupon",
  removeCoupon: "Remove",
  couponApplied: (code: string) => `Coupon ${code} applied`,
  couponRemoved: "Coupon removed",
  totalsTitle: "Cart Total",
  subtotalLabel: "Subtotal:",
  discountLabel: (code: string) => `Discount (${code}):`,
  shippingLabel: "Shipping:",
  free: "Free",
  totalLabel: "Total:",
  proceed: "Proceed to checkout",
  fixIssues: "Fix the items marked above to continue.",
  removed: (name: string) => `${name} removed from cart`,
  undo: "Undo",
  added: (name: string, qty: number) => (qty > 1 ? `${qty} × ${name} added to cart` : `${name} added to cart`),
  outOfStock: "Out of stock",
  onlyLeft: (n: number) => `Only ${n} left`,
  suggestions: "Popular Products",
  remove: (name: string) => `Remove ${name} from cart`,
} as const;

export const wishlistCopy = {
  pageTitle: "My Wishlist",
  crumb: "Wishlist",
  product: "Product",
  price: "Price",
  stockStatus: "Stock Status",
  addToCart: "Add to Cart",
  remove: (name: string) => `Remove ${name} from wishlist`,
  removed: (name: string) => `${name} removed from wishlist`,
  emptyTitle: "Your wishlist is empty",
  emptyBody: "Tap the heart on any product to save it here.",
  browse: "Browse the shop",
  share: "Share:",
  chooseTitle: "Choose an option",
  chooseDescription: (name: string) => `Pick the ${name} option to add to your cart.`,
} as const;
