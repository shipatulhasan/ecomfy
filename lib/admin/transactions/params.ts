import { isDateKey } from "@/lib/admin/date-range";
import type { PaymentAttemptStatus, PaymentMethod, PaymentType } from "@/lib/generated/prisma/enums";

/**
 * Transactions URL state:
 *   ?tab=&q=&method=&status=&type=&from=&to=&min=&max=&attention=1&sort=&page=&txn=
 * Pure: parsed on the server page, serialized by the client toolbar and links.
 */

/** Tab pill (Transaction.png: "All order (240) · Completed · Pending · Canceled"). */
export const TXN_TABS = [
  { key: "all", label: "All", statuses: null },
  { key: "completed", label: "Completed", statuses: ["SUCCEEDED", "REFUNDED"] },
  { key: "pending", label: "Pending", statuses: ["INITIATED", "PENDING"] },
  { key: "cancelled", label: "Canceled", statuses: ["FAILED", "CANCELLED", "EXPIRED"] },
] as const satisfies readonly { key: string; label: string; statuses: readonly PaymentAttemptStatus[] | null }[];

export type TxnTabKey = (typeof TXN_TABS)[number]["key"];

export const TXN_STATUS_FILTERS = ["initiated", "pending", "succeeded", "failed", "cancelled", "expired", "refunded"] as const;
export const TXN_METHOD_FILTERS = ["bkash", "sslcommerz", "cod"] as const;
export const TXN_TYPE_FILTERS = ["charge", "refund", "cod_collection"] as const;
export const TXN_SORTS = ["newest", "oldest", "amount-desc", "amount-asc"] as const;

export const TXN_SORT_LABELS: Record<(typeof TXN_SORTS)[number], string> = {
  newest: "Newest first",
  oldest: "Oldest first",
  "amount-desc": "Amount: high to low",
  "amount-asc": "Amount: low to high",
};

export const TXNS_PER_PAGE = 10; // Transaction.png shows 10 rows

export type TxnListParams = {
  tab: TxnTabKey;
  q: string;
  method: (typeof TXN_METHOD_FILTERS)[number] | null;
  status: (typeof TXN_STATUS_FILTERS)[number] | null;
  type: (typeof TXN_TYPE_FILTERS)[number] | null;
  /** Dhaka calendar dates, inclusive. */
  from: string | null;
  to: string | null;
  /** Whole taka, inclusive (absolute amount, so refunds match too). */
  min: number | null;
  max: number | null;
  attention: boolean;
  sort: (typeof TXN_SORTS)[number];
  page: number;
  /** Detail sheet (Payment id). */
  txn: string | null;
};

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const pick = <T extends string>(list: readonly T[], v: string): T | null => ((list as readonly string[]).includes(v) ? (v as T) : null);
const taka = (v: string) => {
  if (!/^\d{1,9}$/.test(v)) return null;
  return Number(v);
};

export function parseTxnParams(sp: Raw): TxnListParams {
  const tab = pick(
    TXN_TABS.map((t) => t.key),
    one(sp.tab),
  ) ?? "all";
  let from = isDateKey(one(sp.from)) ? one(sp.from) : null;
  let to = isDateKey(one(sp.to)) ? one(sp.to) : null;
  if (from && to && from > to) [from, to] = [to, from];
  let min = taka(one(sp.min));
  let max = taka(one(sp.max));
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  const txn = one(sp.txn);
  return {
    tab,
    q: one(sp.q).trim().slice(0, 100),
    method: pick(TXN_METHOD_FILTERS, one(sp.method)),
    status: pick(TXN_STATUS_FILTERS, one(sp.status)),
    type: pick(TXN_TYPE_FILTERS, one(sp.type)),
    from,
    to,
    min,
    max,
    attention: one(sp.attention) === "1",
    sort: pick(TXN_SORTS, one(sp.sort)) ?? "newest",
    page: Math.max(1, Math.min(100_000, Number.parseInt(one(sp.page), 10) || 1)),
    txn: /^[a-z0-9_-]{1,64}$/i.test(txn) ? txn : null,
  };
}

/**
 * Query string only (no path): shared by the list, sheet and export links. Drops
 * defaults. `patch` resets page unless it sets one; the sheet (`txn`) is kept only
 * when the patch sets it.
 */
export function txnParamsQuery(p: TxnListParams, patch: Partial<TxnListParams> = {}): string {
  const next = { ...p, page: "page" in patch ? patch.page! : 1, txn: "txn" in patch ? patch.txn! : null, ...patch };
  const s = new URLSearchParams();
  if (next.tab !== "all") s.set("tab", next.tab);
  if (next.q) s.set("q", next.q);
  if (next.method) s.set("method", next.method);
  if (next.status) s.set("status", next.status);
  if (next.type) s.set("type", next.type);
  if (next.from) s.set("from", next.from);
  if (next.to) s.set("to", next.to);
  if (next.min !== null) s.set("min", String(next.min));
  if (next.max !== null) s.set("max", String(next.max));
  if (next.attention) s.set("attention", "1");
  if (next.sort !== "newest") s.set("sort", next.sort);
  if (next.page > 1) s.set("page", String(next.page));
  if (next.txn) s.set("txn", next.txn);
  return s.toString();
}

export function txnParamsHref(p: TxnListParams, patch: Partial<TxnListParams> = {}): string {
  const qs = txnParamsQuery(p, patch);
  return `/admin/transactions${qs ? `?${qs}` : ""}`;
}

/** The sheet for one row, keeping the list state (page included). */
export const txnSheetHref = (p: TxnListParams, id: string) => txnParamsHref(p, { page: p.page, txn: id });

/** The list key: everything that changes the rows (not the sheet). */
export const txnListKey = (p: TxnListParams) => txnParamsQuery(p, { page: p.page });

/** Filters beyond the tab (the filter chips). */
export const hasTxnFilters = (p: TxnListParams) =>
  Boolean(p.q || p.method || p.status || p.type || p.from || p.to || p.min !== null || p.max !== null || p.attention);

export const CLEARED_TXN_FILTERS = {
  q: "",
  method: null,
  status: null,
  type: null,
  from: null,
  to: null,
  min: null,
  max: null,
  attention: false,
} as const satisfies Partial<TxnListParams>;

export const toTxnMethod = (m: NonNullable<TxnListParams["method"]>) => m.toUpperCase() as PaymentMethod;
export const toTxnStatus = (s: NonNullable<TxnListParams["status"]>) => s.toUpperCase() as PaymentAttemptStatus;
export const toTxnType = (t: NonNullable<TxnListParams["type"]>) => t.toUpperCase() as PaymentType;
