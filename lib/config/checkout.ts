/**
 * Checkout rules + copy (designs/screens/web/Checkout.png, adapted for Bangladesh:
 * bKash, SSLCommerz cards / online banking, Cash on Delivery).
 */
import type { PaymentMethod } from "@/lib/generated/prisma/enums";

export const PAYMENT_METHODS = ["BKASH", "SSLCOMMERZ", "COD"] as const satisfies readonly PaymentMethod[];


/** placeOrder / retryPayment: per user (or IP for guests). */
export const PLACE_ORDER_LIMIT = { window: 10 * 60, max: 5 };

/** Order numbers: "ECF-004152". The same string is attempt 1's gateway transaction id. */
export const orderNumberFor = (n: number) => `ECF-${String(n).padStart(6, "0")}`;
/** Gateway transaction id for an attempt (unique per gateway session). */
export const paymentReference = (orderNumber: string, attempt: number) =>
  attempt <= 1 ? orderNumber : `${orderNumber}-${attempt}`;

/** Guest orders the browser may view (success / failed pages), httpOnly. */
export const ORDERS_COOKIE = "ecomfy_orders";
export const MAX_COOKIE_ORDERS = 10;

export type MethodMeta = { label: string; description: string; logo: string; logoAlt: string };

export const paymentMethodMeta: Record<PaymentMethod, MethodMeta> = {
  BKASH: {
    label: "bKash",
    description: "Pay from your bKash wallet",
    logo: "/payments/bkash.svg",
    logoAlt: "bKash",
  },
  SSLCOMMERZ: {
    label: "Card / Online Banking",
    description: "Visa, Mastercard, Amex, net banking and other wallets",
    logo: "/payments/cards.svg",
    logoAlt: "Cards and online banking",
  },
  COD: {
    label: "Cash on Delivery",
    description: "Pay in cash when your order arrives",
    logo: "/payments/cod.svg",
    logoAlt: "Cash on Delivery",
  },
};

/** Logos shown in the expanded SSLCommerz card. */
export const sslczAccepted = [
  { src: "/payments/visa.svg", alt: "Visa" },
  { src: "/payments/mastercard.svg", alt: "Mastercard" },
  { src: "/payments/amex.svg", alt: "American Express" },
  { src: "/payments/nexus.svg", alt: "DBBL Nexus" },
  { src: "/payments/netbanking.svg", alt: "Internet banking" },
] as const;

export const checkoutCopy = {
  title: "Checkout",
  crumbCart: "Shopping Cart",
  crumb: "Checkout",
  billingTitle: "Billing Information",
  shippingTitle: "Shipping Address",
  additionalTitle: "Additional Info",
  summaryTitle: "Order Summery", // sic: matches Checkout.png
  paymentTitle: "Payment Method",
  steps: { address: "Address", delivery: "Delivery", payment: "Payment" },
  continue: "Continue",
  edit: "Edit",
  showSummary: "Show order summary",
  hideSummary: "Hide order summary",
  subtotal: "Subtotal:",
  discount: (code: string) => `Discount (${code}):`,
  shipping: "Shipping:",
  codFee: "Cash on Delivery fee:",
  total: "Total:",
  free: "Free",
  chargedIn: (amount: string) => `You'll be charged ${amount} (BDT)`,
  shipDifferent: "Ship to a different address",
  saveAddress: "Save this address to my account",
  notesLabel: "Order Notes (Optional)",
  notesPlaceholder: "Notes about your order, e.g. special notes for delivery",
  deliveryTo: (zone: string) => `Delivery: ${zone}`,
  eta: (text: string) => `Estimated delivery: ${text}`,
  bkashNote: (amount: string) => `You'll be redirected to bKash to pay ${amount}.`,
  sslczNote: "You'll be redirected to the secure SSLCommerz page to pay by card or online banking.",
  codNote: (fee: string | null) =>
    fee ? `A ${fee} Cash on Delivery fee applies. Please keep the exact amount ready.` : "Please keep the exact amount ready.",
  button: {
    BKASH: () => "Pay with bKash",
    SSLCOMMERZ: (amount: string) => `Pay ${amount}`,
    COD: () => "Place order (Cash on Delivery)",
  } satisfies Record<PaymentMethod, (amount: string) => string>,
  placing: "Placing order…",
  redirecting: "Redirecting to payment…",
  methodOff: "Currently unavailable",
} as const;

export const resultCopy = {
  successTitle: "Thank you! Your order is confirmed.",
  codTitle: "Thank you! Your order has been placed.",
  pendingTitle: "We're confirming your payment",
  pendingBody: "This usually takes a few seconds. Refresh this page in a moment.",
  failedTitle: "Payment didn't go through",
  cancelledTitle: "Payment cancelled",
  expiredTitle: "This order expired",
  failedBody: "No money was taken. Your cart is still saved. Try again or pick another payment method.",
  orderNumber: "Order number",
  total: "Total",
  method: "Payment method",
  transaction: "Transaction ID",
  codPay: (amount: string) => `Pay ${amount} in cash on delivery.`,
  delivery: "Estimated delivery",
  continueShopping: "Continue shopping",
  viewOrder: "View order",
  tryAgain: "Try again",
  changeMethod: "Change method",
  backToCart: "Back to cart",
} as const;
