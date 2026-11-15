import "server-only";
import { prisma } from "@/lib/db";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";
import { CANCELLABLE_STATUSES, ORDER_STEPS, paymentMethodLabel } from "@/lib/orders/status";

/**
 * Customer order reads (dashboard, Order History, Order Details, invoice).
 *
 * Per-user and request-time: never `"use cache"`, so no order data is ever shared
 * between users. Callers resolve the user first (requireUser()) inside <Suspense>
 * and pass `userId` in. Every query has `userId` in its WHERE: another customer's
 * order number simply isn't found (the page answers 404, never 403).
 */

export const ORDERS_PER_PAGE = 12; // Order_History.png shows 12 rows
/** "Load more" below laptop is cumulative (?page=N shows pages 1..N); cap the card list. */
const MAX_CARD_PAGES = 20;

// ───────────────────────────── rows (history, dashboard) ─────────────────────────────

export type OrderThumb = { url: string; alt: string };

export type OrderRow = {
  number: number;
  createdAt: Date;
  totalCents: number;
  itemCount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  thumbs: OrderThumb[];
};

const orderRowSelect = {
  number: true,
  createdAt: true,
  totalCents: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  _count: { select: { items: true } },
  items: { orderBy: { id: "asc" }, take: 4, select: { imageUrl: true, productName: true } },
} as const;

type OrderRowSource = Omit<OrderRow, "itemCount" | "thumbs"> & {
  _count: { items: number };
  items: { imageUrl: string | null; productName: string }[];
};

const toOrderRow = ({ _count, items, ...o }: OrderRowSource): OrderRow => ({
  ...o,
  itemCount: _count.items,
  thumbs: items.flatMap((i) => (i.imageUrl ? [{ url: i.imageUrl, alt: i.productName }] : [])),
});

/** Dashboard "Recent Order History" (6 rows in the PNG). */
export async function getRecentOrders(userId: string, take = 6): Promise<OrderRow[]> {
  const rows = await prisma.order.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { number: "desc" }],
    take,
    select: orderRowSelect,
  });
  return rows.map(toOrderRow);
}

export type UserOrdersPage =
  | {
      outOfRange: false;
      /** Laptop+ table: this page only. */
      rows: OrderRow[];
      /** Below laptop: pages 1..page (capped), for "Load more". */
      cards: OrderRow[];
      page: number;
      pages: number;
      total: number;
    }
  | { outOfRange: true; pages: number };

export async function getUserOrders(
  userId: string,
  { page, status }: { page: number; status?: OrderStatus },
): Promise<UserOrdersPage> {
  const where = { userId, ...(status ? { status } : {}) };
  const total = await prisma.order.count({ where });
  const pages = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));
  if (page > pages) return { outOfRange: true, pages };

  const firstCardPage = Math.max(1, page - MAX_CARD_PAGES + 1);
  const all = await prisma.order.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { number: "desc" }],
    skip: (firstCardPage - 1) * ORDERS_PER_PAGE,
    take: (page - firstCardPage + 1) * ORDERS_PER_PAGE,
    select: orderRowSelect,
  });
  const cards = all.map(toOrderRow);
  return {
    outOfRange: false,
    rows: cards.slice((page - firstCardPage) * ORDERS_PER_PAGE),
    cards,
    page,
    pages,
    total,
  };
}

// ───────────────────────────── one order (details, invoice) ─────────────────────────────

/**
 * Order address snapshot for display. Read leniently: snapshots written before the
 * Bangladesh checkout used `state`/`country` instead of `city`/`district`.
 */
export type AddressSnapshot = { name: string; lines: string[]; email: string; phone: string };

export type OrderHistoryEntry = { status: OrderStatus; note: string | null; createdAt: Date };

export type OrderActions = { payNow: boolean; cancel: boolean; orderAgain: boolean; invoice: boolean };

export type OrderDetail = {
  id: string;
  number: number;
  orderNumber: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentMethodLabel: string;
  /** Gateway transaction id of the successful online payment. */
  transactionId: string | null;
  paidAt: Date | null;
  billing: AddressSnapshot | null;
  shipping: AddressSnapshot | null;
  district: string;
  deliveryEstimate: string | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  codFeeCents: number;
  totalCents: number;
  couponCode: string | null;
  history: OrderHistoryEntry[];
  /** Per tracker step (ORDER_STEPS), when it was first reached; null if not (or unknown). */
  stepDates: (Date | null)[];
  actions: OrderActions;
  items: {
    id: string;
    variantId: string | null;
    productName: string;
    variantName: string;
    imageUrl: string | null;
    productSlug: string | null;
    unitPriceCents: number;
    quantity: number;
    subtotalCents: number;
  }[];
};

/** Null unless order `number` belongs to `userId`. */
export async function getUserOrder(userId: string, number: number): Promise<OrderDetail | null> {
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const o = await prisma.order.findFirst({
    where: { number, userId },
    select: {
      id: true,
      number: true,
      orderNumber: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      paidAt: true,
      billingAddress: true,
      shippingAddress: true,
      district: true,
      deliveryEstimate: true,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      codFeeCents: true,
      totalCents: true,
      couponCode: true,
      history: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true } },
      payments: {
        where: { status: "SUCCEEDED" },
        orderBy: { attempt: "desc" },
        take: 1,
        select: { trxId: true, bankTranId: true },
      },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          variantId: true,
          productName: true,
          variantName: true,
          imageUrl: true,
          unitPriceCents: true,
          quantity: true,
          subtotalCents: true,
          variant: { select: { product: { select: { slug: true, status: true } } } },
        },
      },
    },
  });
  if (!o) return null;

  const paid = o.payments[0];
  const items = o.items.map(({ variant, ...i }) => ({
    ...i,
    productSlug: variant?.product.status === "ACTIVE" ? variant.product.slug : null,
  }));
  const online = o.paymentMethod !== "COD";

  return {
    id: o.id,
    number: o.number,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    paymentMethodLabel: paymentMethodLabel(o.paymentMethod),
    transactionId: online ? (paid?.trxId ?? paid?.bankTranId ?? null) : null,
    paidAt: o.paidAt,
    billing: parseAddress(o.billingAddress),
    shipping: parseAddress(o.shippingAddress),
    district: o.district,
    deliveryEstimate: o.deliveryEstimate,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    shippingCents: o.shippingCents,
    codFeeCents: o.codFeeCents,
    totalCents: o.totalCents,
    couponCode: o.couponCode,
    history: o.history,
    stepDates: ORDER_STEPS.map((step, i) => {
      const hit = o.history.find((h) => (step.reachedBy as readonly OrderStatus[]).includes(h.status));
      return hit?.createdAt ?? (i === 0 ? o.createdAt : null);
    }),
    actions: {
      payNow: online && o.paymentStatus !== "PAID" && (o.status === "PENDING_PAYMENT" || o.status === "FAILED"),
      cancel: o.paymentStatus !== "PAID" && (CANCELLABLE_STATUSES as readonly OrderStatus[]).includes(o.status),
      orderAgain: items.some((i) => i.variantId !== null),
      invoice: true,
    },
    items,
  };
}

function parseAddress(json: unknown): AddressSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const a = json as Record<string, unknown>;
  const str = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
  const name = [str("firstName"), str("lastName")].filter(Boolean).join(" ");
  const place = [str("city"), str("district") || str("state")].filter(Boolean).join(", ");
  const lines = [str("companyName"), str("street"), [place, str("zip")].filter(Boolean).join(" ")].filter(Boolean);
  if (!name && lines.length === 0) return null;
  return { name, lines, email: str("email"), phone: str("phone") };
}
