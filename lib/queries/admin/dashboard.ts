import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { DateRange, WeekKey } from "@/lib/admin/date-range";
import { dhakaWeek } from "@/lib/admin/date-range";
import { requirePermission } from "@/lib/auth-guards";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { mediaUrl } from "@/lib/storage/core";
import { Prisma } from "@/lib/generated/prisma/client";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";

/**
 * Admin Dashboard aggregates (Dashboard.png). Everything is aggregated in SQL
 * (count / aggregate / groupBy / $queryRaw); orders are never loaded into JS.
 *
 * - Revenue counts only paymentStatus = PAID, dated by paidAt (createdAt when a
 *   paid order has none).
 * - Order counts exclude EXPIRED and FAILED (abandoned gateway attempts).
 * - Days are Asia/Dhaka calendar days (lib/admin/date-range.ts).
 *
 * Each exported function checks `dashboard:read` (request-time, deduped per
 * request), then calls a `"use cache"` inner function keyed by ISO boundaries,
 * tagged `orders` (+ `products`) and cached briefly. Order/payment mutations
 * expire the tag (lib/orders/cache.ts).
 */
const LIFE = { stale: 60, revalidate: 120, expire: 300 } as const;
const NOT_PLACED: OrderStatus[] = ["EXPIRED", "FAILED"];
const NOT_SOLD: OrderStatus[] = ["CANCELLED", "EXPIRED", "FAILED", "RETURNED"];

const ts = (iso: string) => Prisma.sql`${iso}::timestamp`;
/** Dhaka calendar day of a timestamp(3) column holding UTC. */
const dhakaDay = (col: Prisma.Sql) => Prisma.sql`to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD')`;
const pct = (cur: number, prev: number) => (prev === 0 ? (cur === 0 ? 0 : null) : ((cur - prev) / prev) * 100);

const paidBetween = (start: string, end: string): Prisma.OrderWhereInput => ({
  paymentStatus: "PAID",
  OR: [
    { paidAt: { gte: new Date(start), lt: new Date(end) } },
    { paidAt: null, createdAt: { gte: new Date(start), lt: new Date(end) } },
  ],
});

// ───────────────────────────── KPI cards ─────────────────────────────

export type Trend = { current: number; previous: number; changePct: number | null };

export async function getSalesKpi(range: DateRange): Promise<Trend> {
  await requirePermission("dashboard:read");
  return salesKpi(range.start, range.end, range.prevStart, range.prevEnd);
}

async function salesKpi(start: string, end: string, prevStart: string, prevEnd: string): Promise<Trend> {
  "use cache";
  cacheTag(CacheTags.orders);
  cacheLife(LIFE);
  const [cur, prev] = await Promise.all([
    prisma.order.aggregate({ where: paidBetween(start, end), _sum: { totalCents: true } }),
    prisma.order.aggregate({ where: paidBetween(prevStart, prevEnd), _sum: { totalCents: true } }),
  ]);
  const current = cur._sum.totalCents ?? 0;
  const previous = prev._sum.totalCents ?? 0;
  return { current, previous, changePct: pct(current, previous) };
}

export async function getOrdersKpi(range: DateRange): Promise<Trend> {
  await requirePermission("dashboard:read");
  return ordersKpi(range.start, range.end, range.prevStart, range.prevEnd);
}

async function ordersKpi(start: string, end: string, prevStart: string, prevEnd: string): Promise<Trend> {
  "use cache";
  cacheTag(CacheTags.orders);
  cacheLife(LIFE);
  const count = (s: string, e: string) =>
    prisma.order.count({ where: { createdAt: { gte: new Date(s), lt: new Date(e) }, status: { notIn: NOT_PLACED } } });
  const [current, previous] = await Promise.all([count(start, end), count(prevStart, prevEnd)]);
  return { current, previous, changePct: pct(current, previous) };
}

export type PendingCanceled = { pending: number; pendingCustomers: number; canceled: Trend };

export async function getPendingCanceledKpi(range: DateRange): Promise<PendingCanceled> {
  await requirePermission("dashboard:read");
  return pendingCanceledKpi(range.start, range.end, range.prevStart, range.prevEnd);
}

async function pendingCanceledKpi(start: string, end: string, prevStart: string, prevEnd: string): Promise<PendingCanceled> {
  "use cache";
  cacheTag(CacheTags.orders);
  cacheLife(LIFE);
  const [pendingRows, cur, prev] = await Promise.all([
    // Pending = COD awaiting confirmation + online payment not completed yet.
    prisma.$queryRaw<{ orders: bigint; customers: bigint }[]>`
      SELECT count(*) AS orders, count(DISTINCT COALESCE("userId", lower("email"))) AS customers
      FROM "Order"
      WHERE "status" IN ('PENDING_CONFIRMATION', 'PENDING_PAYMENT')
        AND "createdAt" >= ${ts(start)} AND "createdAt" < ${ts(end)}`,
    prisma.order.count({ where: { status: "CANCELLED", createdAt: { gte: new Date(start), lt: new Date(end) } } }),
    prisma.order.count({ where: { status: "CANCELLED", createdAt: { gte: new Date(prevStart), lt: new Date(prevEnd) } } }),
  ]);
  const row = pendingRows[0];
  return {
    pending: Number(row?.orders ?? 0),
    pendingCustomers: Number(row?.customers ?? 0),
    canceled: { current: cur, previous: prev, changePct: pct(cur, prev) },
  };
}

// ───────────────────────────── Report for this week ─────────────────────────────

export type WeeklyReport = {
  week: WeekKey;
  days: string[]; // 7 Dhaka dates, Sun → Sat
  newCustomers: number;
  totalProducts: number;
  stockProducts: number;
  outOfStock: number;
  revenue: number; // poisha, PAID only
  series: { date: string; customers: number; revenue: number }[];
};

export async function getWeeklyReport(week: WeekKey): Promise<WeeklyReport> {
  await requirePermission("dashboard:read");
  const w = dhakaWeek(week);
  return weeklyReport(week, w.start, w.end, w.days);
}

async function weeklyReport(week: WeekKey, start: string, end: string, days: string[]): Promise<WeeklyReport> {
  "use cache";
  cacheTag(CacheTags.orders, CacheTags.products);
  cacheLife(LIFE);

  const [customersByDay, revenueByDay, stock] = await Promise.all([
    prisma.$queryRaw<{ day: string; n: bigint }[]>`
      SELECT ${dhakaDay(Prisma.sql`"createdAt"`)} AS day, count(*) AS n
      FROM "User"
      WHERE "role" = 'CUSTOMER' AND "createdAt" >= ${ts(start)} AND "createdAt" < ${ts(end)}
      GROUP BY 1`,
    prisma.$queryRaw<{ day: string; cents: bigint }[]>`
      SELECT ${dhakaDay(Prisma.sql`COALESCE("paidAt", "createdAt")`)} AS day, sum("totalCents") AS cents
      FROM "Order"
      WHERE "paymentStatus" = 'PAID'
        AND COALESCE("paidAt", "createdAt") >= ${ts(start)} AND COALESCE("paidAt", "createdAt") < ${ts(end)}
      GROUP BY 1`,
    // Active products, split by whether any variant has stock left after reservations.
    prisma.$queryRaw<{ total: bigint; in_stock: bigint }[]>`
      SELECT count(*) AS total, count(*) FILTER (WHERE s.available > 0) AS in_stock
      FROM "Product" p
      JOIN LATERAL (
        SELECT COALESCE(sum(GREATEST(v."stock" - v."reserved", 0)), 0) AS available
        FROM "Variant" v WHERE v."productId" = p."id"
      ) s ON true
      WHERE p."status" = 'PUBLISHED'`,
  ]);

  const c = new Map(customersByDay.map((r) => [r.day, Number(r.n)]));
  const r = new Map(revenueByDay.map((x) => [x.day, Number(x.cents)]));
  const series = days.map((date) => ({ date, customers: c.get(date) ?? 0, revenue: r.get(date) ?? 0 }));
  const total = Number(stock[0]?.total ?? 0);
  const inStock = Number(stock[0]?.in_stock ?? 0);
  return {
    week,
    days,
    newCustomers: series.reduce((s, d) => s + d.customers, 0),
    totalProducts: total,
    stockProducts: inStock,
    outOfStock: total - inStock,
    revenue: series.reduce((s, d) => s + d.revenue, 0),
    series,
  };
}

// ───────────────────────────── products ─────────────────────────────

export type ProductSales = {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  imageUrl: string | null;
  units: number;
  orders: number;
  available: number;
};

export async function getTopProducts(range: DateRange, limit = 20): Promise<ProductSales[]> {
  await requirePermission("dashboard:read");
  return productSales(range.start, range.end, null, limit);
}

export async function getBestSelling(range: DateRange, categorySlug: string | null, limit = 7): Promise<ProductSales[]> {
  await requirePermission("dashboard:read");
  return productSales(range.start, range.end, categorySlug, limit);
}

async function productSales(start: string, end: string, categorySlug: string | null, limit: number): Promise<ProductSales[]> {
  "use cache";
  cacheTag(CacheTags.orders, CacheTags.products);
  cacheLife(LIFE);
  const categoryFilter = categorySlug
    ? Prisma.sql`AND p."categoryId" = (SELECT "id" FROM "Category" WHERE "slug" = ${categorySlug})`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<
    { id: string; name: string; sku: string; priceCents: number; imageUrl: string | null; units: bigint; orders: bigint; available: bigint }[]
  >`
    SELECT p."id", p."name", p."sku", p."priceCents",
      (SELECT m."key" FROM "ProductImage" i JOIN "Media" m ON m."id" = i."mediaId" WHERE i."productId" = p."id" ORDER BY i."sortOrder" LIMIT 1) AS "imageUrl",
      sum(oi."quantity") AS units,
      count(DISTINCT o."id") AS orders,
      (SELECT COALESCE(sum(GREATEST(v2."stock" - v2."reserved", 0)), 0) FROM "Variant" v2 WHERE v2."productId" = p."id") AS available
    FROM "OrderItem" oi
    JOIN "Order" o ON o."id" = oi."orderId"
    JOIN "Variant" v ON v."id" = oi."variantId"
    JOIN "Product" p ON p."id" = v."productId"
    WHERE o."createdAt" >= ${ts(start)} AND o."createdAt" < ${ts(end)}
      AND o."status" NOT IN (${Prisma.join(NOT_SOLD.map((s) => Prisma.sql`${s}::"OrderStatus"`))})
      ${categoryFilter}
    GROUP BY p."id"
    ORDER BY units DESC, p."name" ASC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    ...r,
    imageUrl: r.imageUrl ? mediaUrl(r.imageUrl) : null,
    units: Number(r.units),
    orders: Number(r.orders),
    available: Number(r.available),
  }));
}

// ───────────────────────────── Transaction (latest orders) ─────────────────────────────

export type TxFilter = "all" | "paid" | "pending";

export type RecentTransaction = {
  number: number;
  createdAt: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  totalCents: number;
  customer: string;
};

export async function getRecentTransactions(filter: TxFilter, take = 5): Promise<RecentTransaction[]> {
  await requirePermission("dashboard:read");
  return recentTransactions(filter, take);
}

async function recentTransactions(filter: TxFilter, take: number): Promise<RecentTransaction[]> {
  "use cache";
  cacheTag(CacheTags.orders);
  cacheLife(LIFE);
  const rows = await prisma.order.findMany({
    where: {
      status: { notIn: NOT_PLACED },
      ...(filter === "paid" ? { paymentStatus: "PAID" as const } : filter === "pending" ? { paymentStatus: "UNPAID" as const } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      number: true,
      createdAt: true,
      paymentStatus: true,
      paymentMethod: true,
      status: true,
      totalCents: true,
      email: true,
      user: { select: { name: true } },
    },
  });
  return rows.map(({ user, email, createdAt, ...o }) => ({ ...o, createdAt: createdAt.toISOString(), customer: user?.name ?? email }));
}

// ───────────────────────────── Add New Product ─────────────────────────────

export type AddNewProductData = {
  categories: { id: string; name: string; slug: string; imageUrl: string | null; products: number }[];
  products: { id: string; name: string; priceCents: number; imageUrl: string | null; status: string }[];
  categoryOptions: { slug: string; name: string }[];
};

export async function getAddNewProduct(): Promise<AddNewProductData> {
  await requirePermission("dashboard:read");
  return addNewProduct();
}

async function addNewProduct(): Promise<AddNewProductData> {
  "use cache";
  cacheTag(CacheTags.products, CacheTags.categories);
  cacheLife(LIFE);
  const productSelect = {
    id: true,
    name: true,
    priceCents: true,
    status: true,
    images: { orderBy: { sortOrder: "asc" as const }, take: 1, select: { media: { select: { key: true } } } },
  };
  const [categories, drafts, allCategories] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ products: { _count: "desc" } }, { sortOrder: "asc" }],
      take: 3,
      select: { id: true, name: true, slug: true, image: { select: { key: true } }, _count: { select: { products: true } } },
    }),
    prisma.product.findMany({ where: { status: "DRAFT" }, orderBy: { createdAt: "desc" }, take: 3, select: productSelect }),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);
  // No drafts waiting: show the newest products instead.
  const products =
    drafts.length > 0
      ? drafts
      : await prisma.product.findMany({ orderBy: { createdAt: "desc" }, take: 3, select: productSelect });
  return {
    categories: categories.map(({ _count, image, ...c }) => ({ ...c, imageUrl: image ? mediaUrl(image.key) : null, products: _count.products })),
    products: products.map(({ images, ...p }) => ({ ...p, imageUrl: images[0] ? mediaUrl(images[0].media.key) : null })),
    categoryOptions: allCategories,
  };
}
