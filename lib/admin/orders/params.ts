import { isDateKey } from "@/lib/admin/date-range";
import { isDistrict } from "@/lib/config/districts";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";

/**
 * Order Management URL state:
 *   ?tab=&q=&status=&method=&payment=&from=&to=&district=&flagged=1&sort=&page=
 * Pure: parsed on the server page, serialized by the client toolbar.
 */

/** Tab pill (Order Management.png: "All order (240) · Completed · Pending · Canceled", extended). */
export const ORDER_TABS = [
  { key: "all", label: "All order", statuses: null },
  { key: "pending", label: "Pending", statuses: ["PENDING_CONFIRMATION", "PENDING_PAYMENT"] },
  { key: "processing", label: "Processing", statuses: ["PROCESSING"] },
  { key: "shipped", label: "Shipped", statuses: ["SHIPPED"] },
  { key: "completed", label: "Completed", statuses: ["DELIVERED"] },
  { key: "cancelled", label: "Cancelled", statuses: ["CANCELLED", "EXPIRED", "FAILED", "RETURNED"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly OrderStatus[] | null }[];

export type OrderTabKey = (typeof ORDER_TABS)[number]["key"];

/** ?status= values (lower-case enum names). */
export const STATUS_FILTERS = [
  "pending_confirmation",
  "pending_payment",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "expired",
  "failed",
] as const;
export const METHOD_FILTERS = ["bkash", "sslcommerz", "cod"] as const;
export const PAYMENT_FILTERS = ["paid", "unpaid", "failed", "refunded"] as const;
export const ORDER_SORTS = ["newest", "oldest", "total-desc", "total-asc"] as const;

export const ORDER_SORT_LABELS: Record<(typeof ORDER_SORTS)[number], string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "total-desc": "Total: high to low",
  "total-asc": "Total: low to high",
};

export const ORDERS_PER_PAGE = 10; // Order Management.png shows 10 rows

export type OrderListParams = {
  tab: OrderTabKey;
  q: string;
  status: (typeof STATUS_FILTERS)[number] | null;
  method: (typeof METHOD_FILTERS)[number] | null;
  payment: (typeof PAYMENT_FILTERS)[number] | null;
  /** Dhaka calendar dates, inclusive. */
  from: string | null;
  to: string | null;
  district: string | null;
  flagged: boolean;
  sort: (typeof ORDER_SORTS)[number];
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pick = <T extends string>(list: readonly T[], v: string): T | null => ((list as readonly string[]).includes(v) ? (v as T) : null);

export function parseOrderParams(sp: Raw): OrderListParams {
  const tab = pick(
    ORDER_TABS.map((t) => t.key),
    one(sp.tab),
  ) ?? "all";
  let from = isDateKey(one(sp.from)) ? one(sp.from) : null;
  let to = isDateKey(one(sp.to)) ? one(sp.to) : null;
  if (from && to && from > to) [from, to] = [to, from];
  return {
    tab,
    q: one(sp.q).trim().slice(0, 100),
    status: pick(STATUS_FILTERS, one(sp.status)),
    method: pick(METHOD_FILTERS, one(sp.method)),
    payment: pick(PAYMENT_FILTERS, one(sp.payment)),
    from,
    to,
    district: isDistrict(one(sp.district)) ? one(sp.district) : null,
    flagged: one(sp.flagged) === "1",
    sort: pick(ORDER_SORTS, one(sp.sort)) ?? "newest",
    page: Math.max(1, Math.min(100_000, Number.parseInt(one(sp.page), 10) || 1)),
  };
}

/** Query string only (no path): shared by the list, export and print links. Drops defaults. */
export function orderParamsQuery(p: OrderListParams, patch: Partial<OrderListParams> = {}): string {
  const next = { ...p, page: "page" in patch ? patch.page! : 1, ...patch };
  const s = new URLSearchParams();
  if (next.tab !== "all") s.set("tab", next.tab);
  if (next.q) s.set("q", next.q);
  if (next.status) s.set("status", next.status);
  if (next.method) s.set("method", next.method);
  if (next.payment) s.set("payment", next.payment);
  if (next.from) s.set("from", next.from);
  if (next.to) s.set("to", next.to);
  if (next.district) s.set("district", next.district);
  if (next.flagged) s.set("flagged", "1");
  if (next.sort !== "newest") s.set("sort", next.sort);
  if (next.page > 1) s.set("page", String(next.page));
  return s.toString();
}

/** Serialize, dropping defaults. `patch` resets page unless it sets one. */
export function orderParamsHref(p: OrderListParams, patch: Partial<OrderListParams> = {}): string {
  const qs = orderParamsQuery(p, patch);
  return `/admin/orders${qs ? `?${qs}` : ""}`;
}

/** Filters beyond the tab (the "More filters" chips). */
export const hasOrderFilters = (p: OrderListParams) =>
  Boolean(p.q || p.status || p.method || p.payment || p.from || p.to || p.district || p.flagged);

export const CLEARED_FILTERS = {
  q: "",
  status: null,
  method: null,
  payment: null,
  from: null,
  to: null,
  district: null,
  flagged: false,
} as const satisfies Partial<OrderListParams>;

export const toStatusEnum = (s: NonNullable<OrderListParams["status"]>) => s.toUpperCase() as OrderStatus;
export const toMethodEnum = (m: NonNullable<OrderListParams["method"]>) => m.toUpperCase() as PaymentMethod;
export const toPaymentEnum = (p: NonNullable<OrderListParams["payment"]>) => p.toUpperCase() as PaymentStatus;

export const METHOD_LABELS: Record<PaymentMethod, string> = { BKASH: "bKash", SSLCOMMERZ: "SSLCommerz", COD: "COD" };

/** "#" + number (order 1042) — the admin's order reference (the customer's "Order 1042"). */
export const orderRef = (number: number) => `#${number}`;
export const adminOrderHref = (number: number) => `/admin/orders/${number}`;
