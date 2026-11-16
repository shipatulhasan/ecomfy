/**
 * Admin Dashboard data for the dev seed: ~60 customers who signed up over the last
 * 90 days and ~900 orders over the same period, spread across statuses, payment
 * methods (bKash / SSLCommerz / COD) and products, so every dashboard widget has
 * realistic numbers. Deterministic (seeded PRNG): the same seed gives the same data,
 * apart from timestamps being relative to "now".
 *
 * Inserted with createMany in batches (orders, items, payments, history).
 */
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../lib/generated/prisma/client";

type Catalog = Record<
  string,
  { id: string; name: string; image: string; variants: Record<string, { id: string; name: string; priceCents: number }> }
>;

type Status = Prisma.OrderCreateManyInput["status"] & string;
type Method = "BKASH" | "SSLCOMMERZ" | "COD";

const DAYS = 90;
const DAY_MS = 86_400_000;
const FIRST_NUMBER = 10_001;

// mulberry32: tiny deterministic PRNG.
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Rahim", "Karim", "Nusrat", "Farhana", "Tanvir", "Sadia", "Imran", "Mehjabin", "Arif", "Shirin", "Rafiq", "Taslima", "Sabbir", "Nadia", "Fahim", "Ayesha", "Rakib", "Mim", "Hasan", "Lamia"];
const LAST = ["Ahmed", "Hossain", "Islam", "Rahman", "Chowdhury", "Khan", "Akter", "Sarkar", "Uddin", "Begum", "Sultana", "Haque"];
const DISTRICTS = ["Dhaka", "Dhaka", "Dhaka", "Gazipur", "Narayanganj", "Chattogram", "Sylhet", "Khulna", "Rajshahi", "Cumilla", "Barishal"];
const INSIDE_DHAKA = ["Dhaka", "Gazipur", "Narayanganj"];

export async function seedDashboard(
  prisma: PrismaClient,
  opts: { catalog: Catalog; hash: string; couponId: string; outOfStock: string[] },
) {
  const rand = prng(20261115);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const now = Date.now();

  // ── customers ──
  const customers: { id: string; name: string; email: string; phone: string; district: string }[] = [];
  const userRows: Prisma.UserCreateManyInput[] = [];
  const accountRows: Prisma.AccountCreateManyInput[] = [];
  for (let i = 0; i < 60; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const id = randomUUID();
    const email = `${name.toLowerCase().replace(/\s+/g, ".")}.${i + 1}@ecomfy.test`;
    const phone = `01${pick(["3", "5", "6", "7", "8", "9"])}${String(int(10_000_000, 99_999_999))}`;
    // Sign-ups lean recent (growth), a few every week.
    const createdAt = new Date(now - Math.floor(DAYS * Math.sqrt(rand())) * DAY_MS - int(0, 20) * 3_600_000);
    customers.push({ id, name, email, phone, district: pick(DISTRICTS) });
    userRows.push({ id, name, email, emailVerified: true, role: "CUSTOMER", phone, createdAt });
    accountRows.push({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password: opts.hash, createdAt });
  }
  await prisma.user.createMany({ data: userRows });
  await prisma.account.createMany({ data: accountRows });

  // ── products, weighted so a few clear best sellers emerge ──
  const slugs = Object.keys(opts.catalog);
  const weights = slugs.map((_, i) => 1 / (1 + i * 0.35));
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const pickSlug = (avoid: string[] = []) => {
    for (;;) {
      let r = rand() * totalWeight;
      for (let i = 0; i < slugs.length; i++) {
        r -= weights[i]!;
        if (r <= 0) {
          if (!avoid.includes(slugs[i]!)) return slugs[i]!;
          break;
        }
      }
    }
  };

  const orders: Prisma.OrderCreateManyInput[] = [];
  const items: Prisma.OrderItemCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const history: Prisma.OrderStatusHistoryCreateManyInput[] = [];
  const reserve = new Map<string, number>();
  let number = FIRST_NUMBER;

  for (let day = DAYS - 1; day >= 0; day--) {
    const dayStart = now - day * DAY_MS;
    const weekday = new Date(dayStart + 6 * 3_600_000).getUTCDay();
    // Growth over the period, busier Fri/Sat (Bangladesh weekend), some noise.
    const base = 6 + (DAYS - day) * 0.075;
    const weekend = weekday === 5 || weekday === 6 ? 1.35 : 1;
    const count = Math.max(2, Math.round(base * weekend * (0.75 + rand() * 0.5)));

    for (let k = 0; k < count; k++) {
      const createdAt = new Date(Math.min(dayStart - int(0, 22 * 60) * 60_000, now - 5 * 60_000));
      const ageH = (now - createdAt.getTime()) / 3_600_000;
      const method: Method = pick(["COD", "COD", "COD", "COD", "BKASH", "BKASH", "BKASH", "SSLCOMMERZ", "SSLCOMMERZ"] as const);
      const r = rand();

      let status: Status;
      if (ageH < 0.4 && method !== "COD" && r < 0.5) status = "PENDING_PAYMENT";
      else if (ageH < 30 && r < 0.45) status = method === "COD" ? "PENDING_CONFIRMATION" : "PROCESSING";
      else if (ageH < 48 && r < 0.75) status = method === "COD" && r < 0.55 ? "PENDING_CONFIRMATION" : "PROCESSING";
      else if (ageH < 96 && r < 0.6) status = "SHIPPED";
      else if (r < 0.08) status = "CANCELLED";
      else if (r < 0.12 && method !== "COD") status = "EXPIRED";
      else if (r < 0.14 && method !== "COD") status = "FAILED";
      else status = ageH < 72 ? "SHIPPED" : "DELIVERED";

      const open = status === "PENDING_PAYMENT" || status === "PENDING_CONFIRMATION";
      const paid =
        (method !== "COD" && (status === "PROCESSING" || status === "SHIPPED" || status === "DELIVERED")) ||
        (method === "COD" && status === "DELIVERED");
      const paidAt = paid
        ? new Date(Math.min(createdAt.getTime() + (method === "COD" ? int(30, 60) * 3_600_000 : int(1, 8) * 60_000), now - 60_000))
        : null;

      const guest = rand() < 0.18;
      const c = pick(customers);
      const name = guest ? `${pick(FIRST)} ${pick(LAST)}` : c.name;
      const email = guest ? `guest.${number}@example.com` : c.email;
      const phone = guest ? `017${String(int(10_000_000, 99_999_999))}` : c.phone;
      const district = guest ? pick(DISTRICTS) : c.district;
      const [firstName, lastName = ""] = name.split(" ");
      const address = { firstName, lastName, street: `House ${int(1, 99)}, Road ${int(1, 30)}`, city: "Sadar", district, zip: "1200", email, phone };

      const id = randomUUID();
      const lineCount = int(1, 4);
      const used: string[] = open ? [...opts.outOfStock] : [];
      let subtotal = 0;
      for (let l = 0; l < lineCount; l++) {
        const slug = pickSlug(used);
        used.push(slug);
        const p = opts.catalog[slug]!;
        const v = pick(Object.values(p.variants));
        const quantity = open ? int(1, 2) : int(1, 5);
        subtotal += v.priceCents * quantity;
        items.push({
          id: randomUUID(),
          orderId: id,
          variantId: v.id,
          productName: p.name,
          variantName: v.name,
          imageUrl: p.image,
          unitPriceCents: v.priceCents,
          quantity,
          subtotalCents: v.priceCents * quantity,
        });
        if (open) reserve.set(v.id, (reserve.get(v.id) ?? 0) + quantity);
      }
      const withCoupon = rand() < 0.1;
      const discount = withCoupon ? Math.round(subtotal * 0.2) : 0;
      const inside = INSIDE_DHAKA.includes(district);
      const shipping = inside ? 6000 : 12000;
      const codFee = method === "COD" ? 2000 : 0;
      const total = subtotal - discount + shipping + codFee;
      const orderNumber = `ECF-${String(number).padStart(6, "0")}`;

      orders.push({
        id,
        number,
        orderNumber,
        idempotencyKey: `seed-dash-${number}`,
        userId: guest ? null : c.id,
        email,
        phone,
        billingAddress: address,
        shippingAddress: address,
        district,
        status,
        paymentStatus: paid ? "PAID" : status === "FAILED" ? "FAILED" : "UNPAID",
        paymentMethod: method,
        subtotalCents: subtotal,
        discountCents: discount,
        shippingCents: shipping,
        codFeeCents: codFee,
        totalCents: total,
        displayTotalCents: total,
        shippingZoneName: inside ? "Inside Dhaka" : "Outside Dhaka",
        deliveryEstimate: inside ? "1–2 days" : "3–5 days",
        stockState: open ? "RESERVED" : status === "CANCELLED" || status === "EXPIRED" || status === "FAILED" ? "RELEASED" : "COMMITTED",
        expiresAt: status === "PENDING_PAYMENT" ? new Date(now + 25 * 60_000) : null,
        paidAt,
        couponId: withCoupon ? opts.couponId : null,
        couponCode: withCoupon ? "ECO20" : null,
        placedIp: "127.0.0.1",
        createdAt,
        updatedAt: paidAt ?? createdAt,
      });
      payments.push({
        id: randomUUID(),
        orderId: id,
        method,
        attempt: 1,
        reference: orderNumber,
        amountCents: total,
        status: paid
          ? "SUCCEEDED"
          : status === "CANCELLED"
            ? "CANCELLED"
            : status === "FAILED"
              ? "FAILED"
              : status === "EXPIRED"
                ? "EXPIRED"
                : method === "COD"
                  ? "PENDING"
                  : "INITIATED",
        trxId: paid && method === "BKASH" ? `SEED${number}` : null,
        bankTranId: paid && method === "SSLCOMMERZ" ? `SEEDBANK${number}` : null,
        completedAt: paidAt,
        createdAt,
      });
      for (const h of timeline(status, method, createdAt, now)) history.push({ id: randomUUID(), orderId: id, ...h });
      number++;
    }
  }

  const chunk = <T>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  for (const c of chunk(orders)) await prisma.order.createMany({ data: c });
  for (const c of chunk(items)) await prisma.orderItem.createMany({ data: c });
  for (const c of chunk(payments)) await prisma.payment.createMany({ data: c });
  for (const c of chunk(history, 1000)) await prisma.orderStatusHistory.createMany({ data: c });
  for (const [variantId, qty] of reserve) {
    await prisma.variant.update({ where: { id: variantId }, data: { reserved: { increment: qty } } });
  }
  return { customers: customers.length, orders: orders.length };
}

function timeline(status: Status, method: Method, placed: Date, now: number) {
  const at = (min: number) => new Date(Math.min(placed.getTime() + min * 60_000, now));
  const cod = method === "COD";
  const rows: { status: Status; note: string; actor: string; createdAt: Date }[] = [
    {
      status: cod ? "PENDING_CONFIRMATION" : "PENDING_PAYMENT",
      note: cod ? "Placed with Cash on Delivery" : "Placed, waiting for payment",
      actor: "customer",
      createdAt: at(0),
    },
  ];
  const step = (["PROCESSING", "SHIPPED", "DELIVERED"] as const).indexOf(status as "PROCESSING");
  if (step >= 0) rows.push({ status: "PROCESSING", note: cod ? "Confirmed by the store" : "Paid online", actor: cod ? "admin" : "system", createdAt: at(90) });
  if (step >= 1) rows.push({ status: "SHIPPED", note: "Handed to the courier", actor: "admin", createdAt: at(20 * 60) });
  if (step >= 2) rows.push({ status: "DELIVERED", note: cod ? "Delivered, paid in cash" : "Delivered", actor: "admin", createdAt: at(44 * 60) });
  if (status === "CANCELLED") rows.push({ status, note: "Cancelled by customer", actor: "customer", createdAt: at(120) });
  if (status === "FAILED") rows.push({ status, note: "Payment declined", actor: "system", createdAt: at(8) });
  if (status === "EXPIRED") rows.push({ status, note: "Unpaid after 30 minutes", actor: "system", createdAt: at(30) });
  return rows;
}
