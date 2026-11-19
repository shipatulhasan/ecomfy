import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { addDays, dhakaMidnight, parseRange } from "@/lib/admin/date-range";
import { maskEmail, maskPhone } from "@/lib/admin/mask";
import {
  toTxnMethod,
  toTxnStatus,
  toTxnType,
  TXN_TABS,
  TXNS_PER_PAGE,
  type TxnListParams,
  type TxnTabKey,
} from "@/lib/admin/transactions/params";
import type { SessionUser } from "@/lib/auth";
import { ActionError, FORBIDDEN } from "@/lib/actions/result";
import { can } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth-guards";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrderStatus, PaymentAttemptStatus, PaymentMethod, PaymentType } from "@/lib/generated/prisma/enums";
import { attentionRows, type AttentionReason } from "@/lib/payments/attention";
import { like, phoneDigits } from "@/lib/queries/admin/orders";
import { parseAddress } from "@/lib/queries/orders";
import { getStoreSettings } from "@/lib/queries/settings";

/**
 * Admin Transactions reads: the Payment ledger (one row per gateway attempt, COD
 * collection and refund; refunds are negative).
 *
 * Rows and the detail carry customer PII, so they are request-time only and the
 * contact is masked here for anyone but ADMIN. Only the PII-free aggregates (KPIs,
 * per-method box) are cached briefly under the `payments` tag, which every payment
 * and refund write expires (lib/orders/cache.ts, admin actions).
 *
 * Money in = SUCCEEDED (or later REFUNDED) charges + COD collections, minus refunds,
 * by the time the gateway settled them (`completedAt`).
 */

const SETTLED_IN: Prisma.PaymentWhereInput = {
  OR: [
    { type: { in: ["CHARGE", "COD_COLLECTION"] }, status: { in: ["SUCCEEDED", "REFUNDED"] } },
    { type: "REFUND", status: "SUCCEEDED" },
  ],
};
const FAILED_STATUSES: PaymentAttemptStatus[] = ["FAILED", "CANCELLED", "EXPIRED"];
const PENDING_STATUSES: PaymentAttemptStatus[] = ["INITIATED", "PENDING"];
const DONE_STATUSES: PaymentAttemptStatus[] = ["SUCCEEDED", "REFUNDED"];

const isAdmin = (user: SessionUser) => user.role === "ADMIN";
const pct = (current: number, previous: number) =>
  previous === 0 ? (current === 0 ? 0 : null) : ((current - previous) / Math.abs(previous)) * 100;

// ───────────────────────────── KPI cards ─────────────────────────────

export type TxnKpi = { current: number; previous: number; changePct: number | null };
export type TxnKpis = {
  label: string;
  /** Net cents received (charges + COD collections − refunds). */
  revenue: TxnKpi & { refundsCents: number; refundCount: number; grossCents: number };
  completed: TxnKpi;
  pending: TxnKpi;
  failed: TxnKpi;
};

/** Transaction.png cards: Total Revenue / Completed / Pending / Failed, last 7 Dhaka days. */
export async function getTransactionKpis(): Promise<TxnKpis> {
  await requirePermission("payments:read");
  const range = parseRange({ range: "7d" });
  return { label: range.label, ...(await txnKpis(range.start, range.end, range.prevStart, range.prevEnd)) };
}

async function txnKpis(start: string, end: string, prevStart: string, prevEnd: string) {
  "use cache";
  cacheTag(CacheTags.payments);
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });

  const period = async (s: string, e: string) => {
    const [money, counts] = await Promise.all([
      prisma.payment.groupBy({
        by: ["type"],
        where: { ...SETTLED_IN, completedAt: { gte: new Date(s), lt: new Date(e) } },
        _sum: { amountCents: true },
        _count: { _all: true },
      }),
      prisma.payment.groupBy({
        by: ["status"],
        where: { type: { not: "REFUND" }, createdAt: { gte: new Date(s), lt: new Date(e) } },
        _count: { _all: true },
      }),
    ]);
    const sumOf = (types: PaymentType[]) =>
      money.filter((r) => types.includes(r.type)).reduce((n, r) => n + (r._sum.amountCents ?? 0), 0);
    const count = (statuses: PaymentAttemptStatus[]) =>
      counts.filter((r) => statuses.includes(r.status)).reduce((n, r) => n + r._count._all, 0);
    const refundsCents = -sumOf(["REFUND"]);
    const grossCents = sumOf(["CHARGE", "COD_COLLECTION"]);
    return {
      net: grossCents - refundsCents,
      grossCents,
      refundsCents,
      refundCount: money.find((r) => r.type === "REFUND")?._count._all ?? 0,
      completed: count(DONE_STATUSES),
      pending: count(PENDING_STATUSES),
      failed: count(FAILED_STATUSES),
    };
  };
  const [cur, prev] = await Promise.all([period(start, end), period(prevStart, prevEnd)]);
  const kpi = (k: "completed" | "pending" | "failed"): TxnKpi => ({
    current: cur[k],
    previous: prev[k],
    changePct: pct(cur[k], prev[k]),
  });
  return {
    revenue: {
      current: cur.net,
      previous: prev.net,
      changePct: pct(cur.net, prev.net),
      refundsCents: cur.refundsCents,
      refundCount: cur.refundCount,
      grossCents: cur.grossCents,
    },
    completed: kpi("completed"),
    pending: kpi("pending"),
    failed: kpi("failed"),
  };
}

// ───────────────────────────── per-method box ─────────────────────────────

export type MethodStat = { method: PaymentMethod; enabled: boolean; count: number; netCents: number };

/** Payment Method box: per method, last 7 days (count = every row; revenue = net money in). */
export async function getMethodBreakdown(): Promise<{ label: string; methods: MethodStat[] }> {
  await requirePermission("payments:read");
  const range = parseRange({ range: "7d" });
  const [stats, settings] = await Promise.all([methodStats(range.start, range.end), getStoreSettings()]);
  const enabled: Record<PaymentMethod, boolean> = {
    BKASH: settings.bkashEnabled,
    SSLCOMMERZ: settings.sslcommerzEnabled,
    COD: settings.codEnabled,
  };
  return {
    label: range.label,
    methods: (["BKASH", "SSLCOMMERZ", "COD"] as const).map((m) => ({
      method: m,
      enabled: enabled[m],
      count: stats.count[m] ?? 0,
      netCents: stats.net[m] ?? 0,
    })),
  };
}

async function methodStats(start: string, end: string) {
  "use cache";
  cacheTag(CacheTags.payments);
  cacheLife({ stale: 60, revalidate: 60, expire: 300 });
  const [money, counts] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      where: { ...SETTLED_IN, completedAt: { gte: new Date(start), lt: new Date(end) } },
      _sum: { amountCents: true },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      where: { type: { not: "REFUND" }, createdAt: { gte: new Date(start), lt: new Date(end) } },
      _count: { _all: true },
    }),
  ]);
  return {
    net: Object.fromEntries(money.map((r) => [r.method, r._sum.amountCents ?? 0])) as Partial<Record<PaymentMethod, number>>,
    count: Object.fromEntries(counts.map((r) => [r.method, r._count._all])) as Partial<Record<PaymentMethod, number>>,
  };
}

// ───────────────────────────── list ─────────────────────────────

export type TxnCustomer = { name: string; email: string | null; phone: string | null; userId: string | null };

export type AdminTxnRow = {
  id: string;
  reference: string;
  /** What the gateway calls it (bKash trxID, SSLCommerz bank_tran_id, bKash paymentID), else our reference. */
  gatewayId: string;
  type: PaymentType;
  method: PaymentMethod;
  status: PaymentAttemptStatus;
  amountCents: number;
  currency: string;
  createdAt: string;
  completedAt: string | null;
  order: { number: number; orderNumber: string };
  customer: TxnCustomer;
  attention: AttentionReason[];
};

export type AdminTxnPage = { rows: AdminTxnRow[]; total: number; page: number; pages: number };

const rowSelect = {
  id: true,
  reference: true,
  type: true,
  method: true,
  status: true,
  amountCents: true,
  currency: true,
  paymentId: true,
  trxId: true,
  bankTranId: true,
  createdAt: true,
  completedAt: true,
  user: { select: { id: true, name: true, email: true, phone: true } },
  order: { select: { number: true, orderNumber: true, email: true, phone: true, billingAddress: true } },
} satisfies Prisma.PaymentSelect;

type RowData = Prisma.PaymentGetPayload<{ select: typeof rowSelect }>;

const gatewayIdOf = (p: { trxId: string | null; bankTranId: string | null; paymentId: string | null; reference: string }) =>
  p.trxId ?? p.bankTranId ?? p.paymentId ?? p.reference;

function customerOf(p: RowData, full: boolean): TxnCustomer {
  const billing = parseAddress(p.order.billingAddress);
  const email = p.user?.email ?? p.order.email ?? null;
  const phone = p.order.phone || p.user?.phone || null;
  return {
    name: p.user?.name || billing?.name || "Guest",
    email: full ? email : maskEmail(email),
    phone: full ? phone : maskPhone(phone),
    userId: p.user?.id ?? null,
  };
}

function toRow(p: RowData, full: boolean, attention: AttentionReason[] = []): AdminTxnRow {
  return {
    id: p.id,
    reference: p.reference,
    gatewayId: gatewayIdOf(p),
    type: p.type,
    method: p.method,
    status: p.status,
    amountCents: p.amountCents,
    currency: p.currency,
    createdAt: p.createdAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
    order: { number: p.order.number, orderNumber: p.order.orderNumber },
    customer: customerOf(p, full),
    attention,
  };
}

/** WHERE for the filters (everything but the tab). */
async function filterWhere(p: TxnListParams): Promise<Prisma.PaymentWhereInput[]> {
  const and: Prisma.PaymentWhereInput[] = [];
  if (p.method) and.push({ method: toTxnMethod(p.method) });
  if (p.status) and.push({ status: toTxnStatus(p.status) });
  if (p.type) and.push({ type: toTxnType(p.type) });
  if (p.from) and.push({ createdAt: { gte: dhakaMidnight(p.from) } });
  if (p.to) and.push({ createdAt: { lt: dhakaMidnight(addDays(p.to, 1)) } });
  // Absolute amount, so "৳500+" finds a ৳500 refund too.
  if (p.min !== null) and.push({ OR: [{ amountCents: { gte: p.min * 100 } }, { amountCents: { lte: -p.min * 100 } }] });
  if (p.max !== null) and.push({ amountCents: { lte: p.max * 100, gte: -p.max * 100 } });
  if (p.attention) and.push({ id: { in: [...(await attentionRows()).keys()] } });

  if (p.q) {
    const q = p.q.replace(/^#/, "");
    const ci = { contains: q, mode: "insensitive" as const };
    const or: Prisma.PaymentWhereInput[] = [
      { reference: ci },
      { paymentId: ci },
      { trxId: ci },
      { valId: ci },
      { bankTranId: ci },
      { order: { orderNumber: ci } },
      { order: { email: ci } },
      { user: { name: ci } },
      { user: { email: ci } },
    ];
    if (/^\d{1,9}$/.test(q)) or.push({ order: { number: Number(q) } });
    const digits = phoneDigits(q);
    if (digits && /^[\d\s+()-]+$/.test(q)) or.push({ order: { phone: { contains: digits } } }, { user: { phone: { contains: digits } } });
    // Guests: the name lives in the order's billing snapshot.
    if (/[a-z]/i.test(q)) {
      const ids = await prisma.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Order"
        WHERE concat_ws(' ', "billingAddress"->>'firstName', "billingAddress"->>'lastName') ILIKE ${like(q)}
        ORDER BY "createdAt" DESC LIMIT 1000`;
      if (ids.length) or.push({ orderId: { in: ids.map((r) => r.id) } });
    }
    and.push({ OR: or });
  }
  return and;
}

const tabWhere = (tab: TxnTabKey): Prisma.PaymentWhereInput => {
  const statuses = TXN_TABS.find((t) => t.key === tab)?.statuses;
  return statuses ? { status: { in: [...statuses] } } : {};
};

const ORDER_BY: Record<TxnListParams["sort"], Prisma.PaymentOrderByWithRelationInput[]> = {
  newest: [{ createdAt: "desc" }, { id: "desc" }],
  oldest: [{ createdAt: "asc" }, { id: "asc" }],
  "amount-desc": [{ amountCents: "desc" }, { id: "desc" }],
  "amount-asc": [{ amountCents: "asc" }, { id: "desc" }],
};

export async function listTransactions(p: TxnListParams): Promise<AdminTxnPage> {
  const user = await requirePermission("payments:read");
  const where: Prisma.PaymentWhereInput = { AND: [...(await filterWhere(p)), tabWhere(p.tab)] };
  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: ORDER_BY[p.sort],
      skip: (p.page - 1) * TXNS_PER_PAGE,
      take: TXNS_PER_PAGE,
      select: rowSelect,
    }),
  ]);
  const flags = await attentionRows(rows.map((r) => r.id));
  const full = isAdmin(user);
  return {
    rows: rows.map((r) => toRow(r, full, flags.get(r.id))),
    total,
    page: p.page,
    pages: Math.max(1, Math.ceil(total / TXNS_PER_PAGE)),
  };
}

/** Tab pill counts for the current filters. */
export async function getTxnTabCounts(p: TxnListParams): Promise<Record<TxnTabKey, number>> {
  await requirePermission("payments:read");
  const rows = await prisma.payment.groupBy({
    by: ["status"],
    where: { AND: await filterWhere(p) },
    _count: { _all: true },
  });
  const n = (statuses: readonly PaymentAttemptStatus[] | null) =>
    rows.filter((r) => !statuses || statuses.includes(r.status)).reduce((s, r) => s + r._count._all, 0);
  return Object.fromEntries(TXN_TABS.map((t) => [t.key, n(t.statuses)])) as Record<TxnTabKey, number>;
}

// ───────────────────────────── detail ─────────────────────────────

export type AdminTxnDetail = AdminTxnRow & {
  paymentId: string | null;
  trxId: string | null;
  valId: string | null;
  bankTranId: string | null;
  sessionKey: string | null;
  attempt: number | null;
  feeCents: number | null;
  cardBrand: string | null;
  cardIssuer: string | null;
  failReason: string | null;
  updatedAt: string;
  orderInfo: { status: OrderStatus; paymentStatus: string; totalCents: number; refundedCents: number };
  refundNote: string | null;
  /** Every other ledger row on the same order, oldest first. */
  siblings: Pick<AdminTxnRow, "id" | "reference" | "type" | "method" | "status" | "amountCents" | "createdAt">[];
  /** Redacted gateway log; null unless the viewer is an ADMIN. */
  raw: unknown;
};

export async function getTransactionDetail(id: string): Promise<AdminTxnDetail | null> {
  const user = await requirePermission("payments:read");
  const full = isAdmin(user);
  const p = await prisma.payment.findUnique({
    where: { id },
    select: {
      ...rowSelect,
      orderId: true,
      attempt: true,
      valId: true,
      sessionKey: true,
      feeCents: true,
      cardBrand: true,
      cardIssuer: true,
      failReason: true,
      updatedAt: true,
      raw: full,
      refund: { select: { note: true } },
      order: {
        select: {
          ...rowSelect.order.select,
          status: true,
          paymentStatus: true,
          totalCents: true,
          refundedCents: true,
        },
      },
    },
  });
  if (!p) return null;
  const [siblings, flags] = await Promise.all([
    prisma.payment.findMany({
      where: { orderId: p.orderId, id: { not: p.id } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, reference: true, type: true, method: true, status: true, amountCents: true, createdAt: true },
    }),
    attentionRows([p.id]),
  ]);
  return {
    ...toRow(p, full, flags.get(p.id)),
    paymentId: p.paymentId,
    trxId: p.trxId,
    valId: p.valId,
    bankTranId: p.bankTranId,
    sessionKey: p.sessionKey,
    attempt: p.attempt,
    feeCents: p.feeCents,
    cardBrand: p.cardBrand,
    cardIssuer: p.cardIssuer,
    failReason: p.failReason,
    updatedAt: p.updatedAt.toISOString(),
    orderInfo: {
      status: p.order.status,
      paymentStatus: p.order.paymentStatus,
      totalCents: p.order.totalCents,
      refundedCents: p.order.refundedCents,
    },
    refundNote: p.refund?.note ?? null,
    siblings: siblings.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
    raw: full ? (p as { raw?: unknown }).raw ?? null : null,
  };
}

// ───────────────────────────── export ─────────────────────────────

export type TxnExportRow = AdminTxnRow & { feeCents: number | null; cardBrand: string | null; failReason: string | null };

/**
 * CSV export of the filtered set (tab + filters + sort), in batches of `batch`
 * using a cursor, so memory stays flat however many rows match. Contact details
 * follow the viewer's role, like the page.
 *
 * The caller authorizes with requirePermission("payments:export") before the
 * response starts and passes that user: batches are read while the response
 * streams, outside the request's session context. The permission is re-checked here.
 */
export async function* streamTransactionsForExport(p: TxnListParams, user: SessionUser, batch = 500): AsyncGenerator<TxnExportRow[]> {
  if (!can(user, "payments:export")) throw new ActionError(FORBIDDEN);
  const full = isAdmin(user);
  const where: Prisma.PaymentWhereInput = { AND: [...(await filterWhere(p)), tabWhere(p.tab)] };
  let cursor: string | null = null;
  for (;;) {
    const rows: (RowData & { feeCents: number | null; cardBrand: string | null; failReason: string | null })[] =
      await prisma.payment.findMany({
        where,
        orderBy: ORDER_BY[p.sort],
        take: batch,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { ...rowSelect, feeCents: true, cardBrand: true, failReason: true },
      });
    if (!rows.length) return;
    const flags = await attentionRows(rows.map((r) => r.id));
    yield rows.map((r) => ({
      ...toRow(r, full, flags.get(r.id)),
      feeCents: r.feeCents,
      cardBrand: r.cardBrand,
      failReason: r.failReason,
    }));
    if (rows.length < batch) return;
    cursor = rows.at(-1)?.id ?? null;
  }
}
