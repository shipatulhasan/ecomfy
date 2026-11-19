import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { addDays, dhakaMidnight, parseRange } from "@/lib/admin/date-range";
import {
  ORDER_TABS,
  ORDERS_PER_PAGE,
  toMethodEnum,
  toPaymentEnum,
  toStatusEnum,
  type OrderListParams,
  type OrderTabKey,
} from "@/lib/admin/orders/params";
import { requirePermission } from "@/lib/auth-guards";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrderStatus, PaymentAttemptStatus, PaymentMethod, PaymentStatus, StockState } from "@/lib/generated/prisma/enums";
import type { InvoiceData } from "@/components/shared/invoice/invoice-sheet";
import { parseAddress, type AddressSnapshot } from "@/lib/queries/orders";
import { getStoreSettings } from "@/lib/queries/settings";

/**
 * Admin order reads (Order Management). Rows and the detail carry customer PII,
 * so they are request-time only: never `"use cache"`, never shared. Only the
 * PII-free aggregates (tab counts, KPI cards) are cached briefly under the
 * `orders` tag, which every order mutation expires.
 *
 * Every exported function checks the permission first.
 */

// ───────────────────────────── list ─────────────────────────────

export type AdminOrderRow = {
  id: string;
  number: number;
  orderNumber: string;
  createdAt: string;
  customer: { name: string; email: string; phone: string; userId: string | null };
  district: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  totalCents: number;
  itemCount: number;
  firstItem: { name: string; imageUrl: string | null } | null;
  codFlagged: boolean;
  codFlagReason: string | null;
  version: number;
  deliveredAt: string | null;
  courier: string | null;
  trackingNumber: string | null;
};

export type AdminOrderPage = { rows: AdminOrderRow[]; total: number; page: number; pages: number };

const rowSelect = {
  id: true,
  number: true,
  orderNumber: true,
  createdAt: true,
  email: true,
  phone: true,
  userId: true,
  billingAddress: true,
  district: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  totalCents: true,
  codFlagged: true,
  codFlagReason: true,
  version: true,
  deliveredAt: true,
  courier: true,
  trackingNumber: true,
  user: { select: { name: true } },
  _count: { select: { items: true } },
  items: { orderBy: { id: "asc" }, take: 1, select: { productName: true, imageUrl: true } },
} satisfies Prisma.OrderSelect;

type RowSource = Prisma.OrderGetPayload<{ select: typeof rowSelect }>;

function toRow(o: RowSource): AdminOrderRow {
  const billing = parseAddress(o.billingAddress);
  return {
    id: o.id,
    number: o.number,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt.toISOString(),
    customer: { name: billing?.name || o.user?.name || o.email, email: o.email, phone: o.phone, userId: o.userId },
    district: o.district,
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    totalCents: o.totalCents,
    itemCount: o._count.items,
    firstItem: o.items[0] ? { name: o.items[0].productName, imageUrl: o.items[0].imageUrl } : null,
    codFlagged: o.codFlagged,
    codFlagReason: o.codFlagReason,
    version: o.version,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    courier: o.courier,
    trackingNumber: o.trackingNumber,
  };
}

export const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** Bangladesh phone digits as stored (01XXXXXXXXX), from "+880 17…", "017-…", … */
export function phoneDigits(q: string): string | null {
  let d = q.replace(/\D/g, "");
  if (d.startsWith("880")) d = d.slice(2);
  return d.length >= 4 ? d : null;
}

/** WHERE for the filters (everything but the tab). Search may run one raw query for names. */
async function filterWhere(p: OrderListParams): Promise<Prisma.OrderWhereInput[]> {
  const and: Prisma.OrderWhereInput[] = [];
  if (p.status) and.push({ status: toStatusEnum(p.status) });
  if (p.method) and.push({ paymentMethod: toMethodEnum(p.method) });
  if (p.payment) and.push({ paymentStatus: toPaymentEnum(p.payment) });
  if (p.from) and.push({ createdAt: { gte: dhakaMidnight(p.from) } });
  if (p.to) and.push({ createdAt: { lt: dhakaMidnight(addDays(p.to, 1)) } });
  if (p.district) and.push({ district: p.district });
  if (p.flagged) and.push({ codFlagged: true });

  if (p.q) {
    const q = p.q.replace(/^#/, "");
    const or: Prisma.OrderWhereInput[] = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { user: { name: { contains: q, mode: "insensitive" } } },
    ];
    if (/^\d{1,9}$/.test(q)) or.push({ number: Number(q) });
    const digits = phoneDigits(q);
    if (digits && /^[\d\s+()-]+$/.test(q)) or.push({ phone: { contains: digits } });
    // Guests: the name lives in the billing snapshot.
    if (/[a-z]/i.test(q)) {
      const ids = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Order"
        WHERE concat_ws(' ', "billingAddress"->>'firstName', "billingAddress"->>'lastName') ILIKE ${like(q)}
        ORDER BY "createdAt" DESC LIMIT 1000`;
      if (ids.length) or.push({ id: { in: ids.map((r) => r.id) } });
    }
    and.push({ OR: or });
  }
  return and;
}

const tabWhere = (tab: OrderTabKey): Prisma.OrderWhereInput => {
  const statuses = ORDER_TABS.find((t) => t.key === tab)?.statuses;
  return statuses ? { status: { in: [...statuses] } } : {};
};

const ORDER_BY: Record<OrderListParams["sort"], Prisma.OrderOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { number: "desc" }],
  oldest: [{ createdAt: "asc" }, { number: "asc" }],
  "total-desc": [{ totalCents: "desc" }, { number: "desc" }],
  "total-asc": [{ totalCents: "asc" }, { number: "desc" }],
};

export const EXPORT_LIMIT = 5000;

export async function listAdminOrders(p: OrderListParams): Promise<AdminOrderPage> {
  await requirePermission("orders:read");
  const where: Prisma.OrderWhereInput = { AND: [tabWhere(p.tab), ...(await filterWhere(p))] };
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: ORDER_BY[p.sort],
      skip: (p.page - 1) * ORDERS_PER_PAGE,
      take: ORDERS_PER_PAGE,
      select: rowSelect,
    }),
  ]);
  return { rows: rows.map(toRow), total, page: p.page, pages: Math.max(1, Math.ceil(total / ORDERS_PER_PAGE)) };
}

/** Tab counts for the current filters (the tabs narrow, the filters stay). */
export async function getOrderTabCounts(p: OrderListParams): Promise<Record<OrderTabKey, number>> {
  await requirePermission("orders:read");
  const filters = await filterWhere(p);
  // No filters: the common case, cached briefly (counts only, no PII).
  const rows = filters.length
    ? await prisma.order.groupBy({ by: ["status"], where: { AND: filters }, _count: { _all: true } })
    : await cachedStatusCounts();
  const n = (statuses: readonly OrderStatus[] | null) =>
    rows.filter((r) => !statuses || statuses.includes(r.status)).reduce((s, r) => s + r._count._all, 0);
  return Object.fromEntries(ORDER_TABS.map((t) => [t.key, n(t.statuses)])) as Record<OrderTabKey, number>;
}

async function cachedStatusCounts() {
  "use cache";
  cacheTag(CacheTags.orders);
  cacheLife("seconds");
  const rows = await prisma.order.groupBy({ by: ["status"], _count: { _all: true } });
  return rows.map((r) => ({ status: r.status, _count: { _all: r._count._all } }));
}

/** "N new orders" pill: orders placed after the list was rendered. */
export async function countOrdersSince(sinceIso: string): Promise<number> {
  await requirePermission("orders:read");
  const since = new Date(sinceIso);
  if (Number.isNaN(+since)) return 0;
  return prisma.order.count({ where: { createdAt: { gt: since }, status: { notIn: ["EXPIRED", "FAILED"] } } });
}

/** CSV export: every matching row (current tab + filters), capped; or exactly `numbers` (bulk selection). */
export async function listOrdersForExport(p: OrderListParams, numbers?: number[]) {
  await requirePermission("orders:read");
  const where: Prisma.OrderWhereInput = numbers?.length
    ? { number: { in: numbers.slice(0, EXPORT_LIMIT) } }
    : { AND: [tabWhere(p.tab), ...(await filterWhere(p))] };
  const rows = await prisma.order.findMany({
    where,
    orderBy: ORDER_BY[p.sort],
    take: EXPORT_LIMIT,
    select: {
      ...rowSelect,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      codFeeCents: true,
      refundedCents: true,
      couponCode: true,
      paidAt: true,
      items: { orderBy: { id: "asc" }, select: { productName: true, variantName: true, quantity: true } },
    },
  });
  return rows.map((o) => ({
    ...toRow({ ...o, items: o.items.slice(0, 1).map((i) => ({ productName: i.productName, imageUrl: null })) }),
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    shippingCents: o.shippingCents,
    codFeeCents: o.codFeeCents,
    refundedCents: o.refundedCents,
    couponCode: o.couponCode,
    paidAt: o.paidAt?.toISOString() ?? null,
    lines: o.items.map((i) => `${i.productName}${i.variantName ? ` (${i.variantName})` : ""} x${i.quantity}`).join("; "),
  }));
}

/** Order numbers matching the current list (print invoices for a filtered page). */
export async function listOrderNumbers(p: OrderListParams, take = 50): Promise<number[]> {
  await requirePermission("orders:read");
  const where: Prisma.OrderWhereInput = { AND: [tabWhere(p.tab), ...(await filterWhere(p))] };
  const rows = await prisma.order.findMany({
    where,
    orderBy: ORDER_BY[p.sort],
    skip: (p.page - 1) * ORDERS_PER_PAGE,
    take,
    select: { number: true },
  });
  return rows.map((r) => r.number);
}

// ───────────────────────────── KPI cards ─────────────────────────────

export type OrderKpi = { current: number; previous: number; changePct: number | null };
export type OrderKpis = { label: string; total: OrderKpi; pending: OrderKpi; completed: OrderKpi; completedShare: number; cancelled: OrderKpi };

/** Order Management.png cards: Total / New (pending) / Completed / Cancelled, last 7 Dhaka days. */
export async function getOrderKpis(): Promise<OrderKpis> {
  await requirePermission("orders:read");
  const range = parseRange({ range: "7d" });
  return { label: range.label, ...(await orderKpis(range.start, range.end, range.prevStart, range.prevEnd)) };
}

async function orderKpis(start: string, end: string, prevStart: string, prevEnd: string) {
  "use cache";
  cacheTag(CacheTags.orders);
  cacheLife({ stale: 60, revalidate: 120, expire: 300 });
  const between = (s: string, e: string) => ({ createdAt: { gte: new Date(s), lt: new Date(e) } });
  const counts = (s: string, e: string) =>
    prisma.order.groupBy({ by: ["status"], where: between(s, e), _count: { _all: true } });
  const [cur, prev] = await Promise.all([counts(start, end), counts(prevStart, prevEnd)]);
  const sum = (rows: typeof cur, statuses: OrderStatus[] | null, exclude: OrderStatus[] = []) =>
    rows
      .filter((r) => (!statuses || statuses.includes(r.status)) && !exclude.includes(r.status))
      .reduce((s, r) => s + r._count._all, 0);
  const kpi = (statuses: OrderStatus[] | null, exclude: OrderStatus[] = []): OrderKpi => {
    const current = sum(cur, statuses, exclude);
    const previous = sum(prev, statuses, exclude);
    return { current, previous, changePct: previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / previous) * 100 };
  };
  // Same rule as the dashboard: abandoned gateway attempts (expired / failed) aren't orders.
  const total = kpi(null, ["EXPIRED", "FAILED"]);
  const completed = kpi(["DELIVERED"]);
  return {
    total,
    pending: kpi(["PENDING_CONFIRMATION", "PENDING_PAYMENT"]),
    completed,
    completedShare: total.current ? (completed.current / total.current) * 100 : 0,
    cancelled: kpi(["CANCELLED"]),
  };
}

// ───────────────────────────── detail ─────────────────────────────

export type AdminOrderDetail = {
  id: string;
  number: number;
  orderNumber: string;
  version: number;
  createdAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  stockState: StockState;
  email: string;
  phone: string;
  customer: { userId: string | null; name: string; isGuest: boolean; orderCount: number };
  codFlagged: boolean;
  codFlagReason: string | null;
  /** COD orders on this phone that were cancelled (excluding this one). */
  codCancellations: { number: number; createdAt: string; reason: string | null }[];
  billing: AddressSnapshot | null;
  shipping: AddressSnapshot | null;
  district: string;
  shippingZoneName: string | null;
  deliveryEstimate: string | null;
  notes: string | null;
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  shippingCents: number;
  codFeeCents: number;
  totalCents: number;
  refundedCents: number;
  currency: string;
  displayCurrency: string;
  displayTotalCents: number;
  paidAt: string | null;
  courier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: {
    id: string;
    productId: string | null;
    productName: string;
    variantName: string;
    sku: string | null;
    imageUrl: string | null;
    unitPriceCents: number;
    quantity: number;
    subtotalCents: number;
  }[];
  timeline: {
    id: string;
    status: OrderStatus | null;
    note: string | null;
    actor: string;
    actorName: string | null;
    internal: boolean;
    createdAt: string;
  }[];
  payments: {
    id: string;
    attempt: number;
    method: PaymentMethod;
    reference: string;
    amountCents: number;
    status: PaymentAttemptStatus;
    trxId: string | null;
    paymentId: string | null;
    valId: string | null;
    bankTranId: string | null;
    failReason: string | null;
    createdAt: string;
    completedAt: string | null;
    /** Redacted gateway log; ADMIN only (null for staff). */
    raw: unknown;
  }[];
  refunds: { id: string; amountCents: number; note: string | null; actorName: string | null; createdAt: string }[];
  settings: { couriers: string[]; returnWindowDays: number };
};

export async function getAdminOrderDetail(number: number): Promise<AdminOrderDetail | null> {
  const user = await requirePermission("orders:read");
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const o = await prisma.order.findUnique({
    where: { number },
    include: {
      user: { select: { name: true } },
      items: {
        orderBy: { id: "asc" },
        include: { variant: { select: { sku: true, productId: true } } },
      },
      history: { orderBy: { createdAt: "asc" }, include: { actorUser: { select: { name: true } } } },
      payments: { where: { type: { not: "REFUND" } }, orderBy: { attempt: "asc" } },
      refunds: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!o) return null;

  const showRaw = user.role === "ADMIN"; // raw gateway logs: admins only
  const [orderCount, cancellations, settings] = await Promise.all([
    o.userId
      ? prisma.order.count({ where: { userId: o.userId, status: { notIn: ["EXPIRED", "FAILED"] } } })
      : prisma.order.count({ where: { email: o.email, status: { notIn: ["EXPIRED", "FAILED"] } } }),
    prisma.order.findMany({
      where: { phone: o.phone, paymentMethod: "COD", status: "CANCELLED", id: { not: o.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { number: true, createdAt: true, cancelReason: true },
    }),
    getStoreSettings(),
  ]);
  const billing = parseAddress(o.billingAddress);

  return {
    id: o.id,
    number: o.number,
    orderNumber: o.orderNumber,
    version: o.version,
    createdAt: o.createdAt.toISOString(),
    status: o.status,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    stockState: o.stockState,
    email: o.email,
    phone: o.phone,
    customer: { userId: o.userId, name: billing?.name || o.user?.name || o.email, isGuest: !o.userId, orderCount },
    codFlagged: o.codFlagged,
    codFlagReason: o.codFlagReason,
    codCancellations: cancellations.map((c) => ({ number: c.number, createdAt: c.createdAt.toISOString(), reason: c.cancelReason })),
    billing,
    shipping: parseAddress(o.shippingAddress),
    district: o.district,
    shippingZoneName: o.shippingZoneName,
    deliveryEstimate: o.deliveryEstimate,
    notes: o.notes,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    couponCode: o.couponCode,
    shippingCents: o.shippingCents,
    codFeeCents: o.codFeeCents,
    totalCents: o.totalCents,
    refundedCents: o.refundedCents,
    currency: o.currency,
    displayCurrency: o.displayCurrency,
    displayTotalCents: o.displayTotalCents,
    paidAt: o.paidAt?.toISOString() ?? null,
    courier: o.courier,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    deliveredAt: o.deliveredAt?.toISOString() ?? null,
    cancelledAt: o.cancelledAt?.toISOString() ?? null,
    cancelReason: o.cancelReason,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.variant?.productId ?? null,
      productName: i.productName,
      variantName: i.variantName,
      sku: i.variant?.sku ?? null,
      imageUrl: i.imageUrl,
      unitPriceCents: i.unitPriceCents,
      quantity: i.quantity,
      subtotalCents: i.subtotalCents,
    })),
    timeline: o.history.map((h) => ({
      id: h.id,
      status: h.status,
      note: h.note,
      actor: h.actor,
      actorName: h.actorUser?.name ?? null,
      internal: h.internal,
      createdAt: h.createdAt.toISOString(),
    })),
    payments: o.payments.map((p) => ({
      id: p.id,
      attempt: p.attempt ?? 0,
      method: p.method,
      reference: p.reference,
      amountCents: p.amountCents,
      status: p.status,
      trxId: p.trxId,
      paymentId: p.paymentId,
      valId: p.valId,
      bankTranId: p.bankTranId,
      failReason: p.failReason,
      createdAt: p.createdAt.toISOString(),
      completedAt: p.completedAt?.toISOString() ?? null,
      raw: showRaw ? p.raw : null,
    })),
    refunds: o.refunds.map((r) => ({
      id: r.id,
      amountCents: r.amountCents,
      note: r.note,
      actorName: r.actor?.name ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    settings: { couriers: settings.couriers, returnWindowDays: settings.returnWindowDays },
  };
}

/** Couriers for the bulk "Mark shipped" dialog. */
export async function getCourierOptions(): Promise<string[]> {
  await requirePermission("orders:read");
  return (await getStoreSettings()).couriers;
}

/** "1,2,3" → order numbers (bulk selection links); invalid parts dropped, capped. */
export function parseNumberList(raw: string | null | undefined, max = 200): number[] {
  if (!raw) return [];
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const n = Number(part.trim());
    if (Number.isSafeInteger(n) && n > 0) out.add(n);
    if (out.size >= max) break;
  }
  return [...out];
}

// ───────────────────────────── invoices ─────────────────────────────

/** Invoice data for the admin print routes (one or many orders, in the given order). */
export async function getOrdersForInvoice(numbers: number[]): Promise<InvoiceData[]> {
  await requirePermission("orders:read");
  if (!numbers.length) return [];
  const rows = await prisma.order.findMany({
    where: { number: { in: numbers } },
    select: {
      number: true,
      orderNumber: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      billingAddress: true,
      shippingAddress: true,
      subtotalCents: true,
      discountCents: true,
      couponCode: true,
      shippingCents: true,
      codFeeCents: true,
      totalCents: true,
      payments: { where: { type: { not: "REFUND" }, status: { in: ["SUCCEEDED", "REFUNDED"] } }, orderBy: { attempt: "desc" }, take: 1, select: { trxId: true, bankTranId: true } },
      items: {
        orderBy: { id: "asc" },
        select: { id: true, productName: true, variantName: true, unitPriceCents: true, quantity: true, subtotalCents: true },
      },
    },
  });
  const byNumber = new Map(rows.map((r) => [r.number, r]));
  return numbers.flatMap((n) => {
    const o = byNumber.get(n);
    if (!o) return [];
    const paid = o.payments[0];
    return [
      {
        number: o.number,
        orderNumber: o.orderNumber,
        createdAt: o.createdAt,
        status: o.status,
        paymentStatus: o.paymentStatus,
        paymentMethod: o.paymentMethod,
        transactionId: o.paymentMethod === "COD" ? null : (paid?.trxId ?? paid?.bankTranId ?? null),
        billing: parseAddress(o.billingAddress),
        shipping: parseAddress(o.shippingAddress),
        subtotalCents: o.subtotalCents,
        discountCents: o.discountCents,
        couponCode: o.couponCode,
        shippingCents: o.shippingCents,
        codFeeCents: o.codFeeCents,
        totalCents: o.totalCents,
        items: o.items,
      },
    ];
  });
}
