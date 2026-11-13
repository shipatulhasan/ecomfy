import "server-only";
import { prisma } from "@/lib/db";
import { orderStatusView, paymentMethodLabel, type OrderStatusView } from "@/lib/orders/status";
import type { OrderStatus } from "@/lib/generated/prisma/enums";

/**
 * Customer account reads (dashboard, order history, order details, settings).
 * Per-user and request-time: never `"use cache"`. Callers resolve the user first
 * (requireUser()) and pass `userId` in, inside <Suspense>. Every query is scoped
 * by userId, so one customer can never read another's orders.
 */

export type AccountProfile = {
  name: string;
  email: string;
  phone: string | null;
  image: string | null;
  role: "CUSTOMER" | "ADMIN";
  emailVerified: boolean;
};

export async function getAccountProfile(userId: string): Promise<AccountProfile | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true, image: true, role: true, emailVerified: true },
  });
}

/** A saved address as the forms edit it (strings; district may be legacy text). */
export type AccountAddress = {
  id: string;
  firstName: string;
  lastName: string;
  companyName: string;
  street: string;
  city: string;
  district: string;
  zip: string;
  email: string;
  phone: string;
};

/** The address the dashboard and Settings show: the default BILLING one. */
export async function getDefaultBillingAddress(userId: string): Promise<AccountAddress | null> {
  const row = await prisma.address.findFirst({
    where: { userId, kind: "BILLING" },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      companyName: true,
      street: true,
      city: true,
      district: true,
      zip: true,
      email: true,
      phone: true,
    },
  });
  return row ? { ...row, companyName: row.companyName ?? "" } : null;
}

export type OrderRow = {
  number: number;
  createdAt: Date;
  totalCents: number;
  itemCount: number;
  status: OrderStatusView;
};

const orderRowSelect = {
  number: true,
  createdAt: true,
  totalCents: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  _count: { select: { items: true } },
} as const;

type OrderRowSource = {
  number: number;
  createdAt: Date;
  totalCents: number;
  status: OrderStatus;
  paymentStatus: Parameters<typeof orderStatusView>[1];
  paymentMethod: Parameters<typeof orderStatusView>[2];
  _count: { items: number };
};

const toOrderRow = (o: OrderRowSource): OrderRow => ({
  number: o.number,
  createdAt: o.createdAt,
  totalCents: o.totalCents,
  itemCount: o._count.items,
  status: orderStatusView(o.status, o.paymentStatus, o.paymentMethod),
});

/** Dashboard "Recent Order History" (6 rows in the PNG). */
export async function getRecentOrders(userId: string, take = 6): Promise<OrderRow[]> {
  const rows = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: orderRowSelect,
  });
  return rows.map(toOrderRow);
}

export const ORDERS_PER_PAGE = 12; // Order_History.png shows 12 rows

export type OrdersPage = { rows: OrderRow[]; page: number; pages: number; total: number };

export async function getOrdersPage(userId: string, page: number): Promise<OrdersPage> {
  const total = await prisma.order.count({ where: { userId } });
  const pages = Math.max(1, Math.ceil(total / ORDERS_PER_PAGE));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  const rows = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: (current - 1) * ORDERS_PER_PAGE,
    take: ORDERS_PER_PAGE,
    select: orderRowSelect,
  });
  return { rows: rows.map(toOrderRow), page: current, pages, total };
}

export type OrderDetail = {
  number: number;
  createdAt: Date;
  status: OrderStatus;
  statusView: OrderStatusView;
  paymentMethod: string;
  billing: AddressSnapshot | null;
  shipping: AddressSnapshot | null;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  codFeeCents: number;
  totalCents: number;
  couponCode: string | null;
  items: {
    id: string;
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
export async function getOrderDetail(userId: string, number: number): Promise<OrderDetail | null> {
  if (!Number.isSafeInteger(number) || number < 1) return null;
  const o = await prisma.order.findFirst({
    where: { number, userId },
    select: {
      number: true,
      createdAt: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      billingAddress: true,
      shippingAddress: true,
      subtotalCents: true,
      discountCents: true,
      shippingCents: true,
      codFeeCents: true,
      totalCents: true,
      couponCode: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
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
  return {
    number: o.number,
    createdAt: o.createdAt,
    status: o.status,
    statusView: orderStatusView(o.status, o.paymentStatus, o.paymentMethod),
    paymentMethod: paymentMethodLabel(o.paymentMethod),
    billing: parseAddress(o.billingAddress),
    shipping: parseAddress(o.shippingAddress),
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    shippingCents: o.shippingCents,
    codFeeCents: o.codFeeCents,
    totalCents: o.totalCents,
    couponCode: o.couponCode,
    items: o.items.map(({ variant, ...i }) => ({
      ...i,
      productSlug: variant?.product.status === "ACTIVE" ? variant.product.slug : null,
    })),
  };
}

/** Mobile profile screen: the quick-stats rail. */
export async function getAccountStats(userId: string): Promise<{ orders: number; wishlist: number; cart: number }> {
  const [orders, wishlist, cart] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.wishlist.count({ where: { userId, product: { status: "ACTIVE" } } }),
    prisma.cartItem.aggregate({ where: { cart: { userId } }, _sum: { quantity: true } }),
  ]);
  return { orders, wishlist, cart: cart._sum.quantity ?? 0 };
}

/**
 * Order address snapshot for display. Read leniently: snapshots written before the
 * Bangladesh checkout used `state`/`country` instead of `city`/`district`.
 */
export type AddressSnapshot = { name: string; lines: string[]; email: string; phone: string };

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
