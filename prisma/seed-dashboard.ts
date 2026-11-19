/**
 * Admin Dashboard data for the dev seed: ~60 customers who signed up over the last
 * 90 days and ~900 orders over the same period, spread across statuses, payment
 * methods (bKash / SSLCommerz / COD) and products, so every dashboard widget has
 * realistic numbers. Deterministic (seeded PRNG): the same seed gives the same data,
 * apart from timestamps being relative to "now".
 *
 * Order Management coverage: every status × payment method (fixtures top up any
 * combination the random spread missed), a few flagged COD phones (customers with
 * earlier cancelled COD orders), orders with several payment attempts, courier +
 * tracking on shipped orders, staff actors on admin steps, and manual refunds.
 *
 * Transactions coverage (Payment ledger): every row has a type (CHARGE / COD_COLLECTION
 * / REFUND, refunds negative and linked to their Refund), failed attempts before a
 * success, gateway fee + card on SSLCommerz successes, and one fixture per
 * "needs attention" rule (lib/payments/attention.ts).
 *
 * Inserted with createMany in batches (orders, items, payments, history, refunds).
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
  opts: { catalog: Catalog; hash: string; couponId: string; outOfStock: string[]; adminId: string; staffId: string },
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
  const refunds: Prisma.RefundCreateManyInput[] = [];
  const reserve = new Map<string, number>();
  /** Cancelled COD orders per phone so far (orders are generated oldest first): the checkout flag rule. */
  const codCancelled = new Map<string, number>();
  const staff = [opts.adminId, opts.staffId];
  let number = FIRST_NUMBER;

  // A few customers who keep cancelling COD orders: their later COD orders are flagged.
  const risky = customers.slice(0, 4);

  type Who = { name: string; email: string; phone: string; district: string; userId: string | null };
  const randomWho = (): Who => {
    if (rand() < 0.18) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      return { name, email: `guest.${number}@example.com`, phone: `017${String(int(10_000_000, 99_999_999))}`, district: pick(DISTRICTS), userId: null };
    }
    const c = pick(customers.slice(risky.length));
    return { name: c.name, email: c.email, phone: c.phone, district: c.district, userId: c.id };
  };
  const whoOf = (c: (typeof customers)[number]): Who => ({ name: c.name, email: c.email, phone: c.phone, district: c.district, userId: c.id });

  /** One order with everything that goes with its status (items, attempts, history, shipping, refunds). */
  function add(
    createdAt: Date,
    method: Method,
    status: Status,
    who: Who,
    o: { retries?: number; refund?: boolean; cancelReason?: string; paidNoRefund?: boolean } = {},
  ) {
    const ageH = (now - createdAt.getTime()) / 3_600_000;
    const open = status === "PENDING_PAYMENT" || status === "PENDING_CONFIRMATION";
    const paid =
      (method !== "COD" && (status === "PROCESSING" || status === "SHIPPED" || status === "DELIVERED" || status === "RETURNED" || (status === "CANCELLED" && (!!o.refund || !!o.paidNoRefund)))) ||
      (method === "COD" && (status === "DELIVERED" || status === "RETURNED"));
    const paidAt = paid
      ? new Date(Math.min(createdAt.getTime() + (method === "COD" ? int(30, 60) * 3_600_000 : int(1, 8) * 60_000), now - 60_000))
      : null;

    const [firstName, lastName = ""] = who.name.split(" ");
    const address = { firstName, lastName, street: `House ${int(1, 99)}, Road ${int(1, 30)}`, city: "Sadar", district: who.district, zip: "1200", email: who.email, phone: who.phone };

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
    const inside = INSIDE_DHAKA.includes(who.district);
    const shipping = inside ? 6000 : 12000;
    const codFee = method === "COD" ? 2000 : 0;
    const total = subtotal - discount + shipping + codFee;
    const orderNumber = `ECF-${String(number).padStart(6, "0")}`;

    // Checkout's COD rule: phones with earlier cancelled COD orders are flagged.
    const priorCancels = method === "COD" ? (codCancelled.get(who.phone) ?? 0) : 0;
    if (method === "COD" && status === "CANCELLED") codCancelled.set(who.phone, priorCancels + 1);

    const steps = timeline(status, method, createdAt, now, staff, pick, { cancelReason: o.cancelReason, paidBeforeCancel: status === "CANCELLED" && paid });
    const stepAt = (s: Status) => steps.find((h) => h.status === s)?.createdAt ?? null;
    const shipped = status === "SHIPPED" || status === "DELIVERED" || status === "RETURNED";
    const courier = shipped ? pick(COURIERS) : null;
    const refunded = o.refund && paid;

    orders.push({
      id,
      number,
      orderNumber,
      idempotencyKey: `seed-dash-${number}`,
      userId: who.userId,
      email: who.email,
      phone: who.phone,
      billingAddress: address,
      shippingAddress: address,
      district: who.district,
      status,
      paymentStatus: refunded ? "REFUNDED" : paid ? "PAID" : status === "FAILED" ? "FAILED" : "UNPAID",
      paymentMethod: method,
      subtotalCents: subtotal,
      discountCents: discount,
      shippingCents: shipping,
      codFeeCents: codFee,
      totalCents: total,
      refundedCents: refunded ? total : 0,
      displayTotalCents: total,
      shippingZoneName: inside ? "Inside Dhaka" : "Outside Dhaka",
      deliveryEstimate: inside ? "1–2 days" : "3–5 days",
      stockState: open ? "RESERVED" : status === "CANCELLED" || status === "EXPIRED" || status === "FAILED" || status === "RETURNED" ? "RELEASED" : "COMMITTED",
      expiresAt: status === "PENDING_PAYMENT" ? new Date(now + 25 * 60_000) : null,
      paidAt,
      courier,
      trackingNumber: courier ? `${courier.slice(0, 2).toUpperCase()}${number}${int(100, 999)}` : null,
      shippedAt: stepAt("SHIPPED"),
      deliveredAt: stepAt("DELIVERED"),
      cancelledAt: status === "CANCELLED" ? stepAt("CANCELLED") : null,
      cancelReason: status === "CANCELLED" ? (steps.find((h) => h.status === "CANCELLED")?.note ?? null) : null,
      codFlagged: priorCancels > 0,
      codFlagReason: priorCancels > 0 ? `${priorCancels} previously cancelled COD order${priorCancels === 1 ? "" : "s"}` : null,
      couponId: withCoupon ? opts.couponId : null,
      couponCode: withCoupon ? "ECO20" : null,
      placedIp: "127.0.0.1",
      createdAt,
      updatedAt: steps.at(-1)?.createdAt ?? createdAt,
    });

    // Earlier failed / abandoned gateway attempts, then the one that decided the order.
    const retries = method === "COD" ? 0 : (o.retries ?? 0);
    for (let a = 1; a <= retries; a++) {
      const at = new Date(Math.min(createdAt.getTime() + (a - 1) * 4 * 60_000, now - 120_000));
      payments.push({
        id: randomUUID(),
        orderId: id,
        userId: who.userId,
        type: "CHARGE",
        method,
        attempt: a,
        reference: a === 1 ? orderNumber : `${orderNumber}-${a}`,
        amountCents: total,
        status: a % 2 ? "FAILED" : "CANCELLED",
        failReason: a % 2 ? pick(["Insufficient balance", "Wrong PIN", "Card declined by the bank"]) : "Cancelled at the gateway",
        trxId: null,
        completedAt: new Date(at.getTime() + 90_000),
        raw: [{ at: at.toISOString(), tag: method === "BKASH" ? "[bkash]" : "[sslcommerz]", event: "callback", data: { status: "failure" } }],
        createdAt: at,
      });
    }
    const last = retries + 1;
    const sslPaid = paid && method === "SSLCOMMERZ";
    const finalPayment = {
      id: randomUUID(),
      orderId: id,
      userId: who.userId,
      type: method === "COD" ? "COD_COLLECTION" : "CHARGE",
      method,
      attempt: last,
      reference: last === 1 ? orderNumber : `${orderNumber}-${last}`,
      amountCents: total,
      status: refunded
        ? "REFUNDED"
        : paid
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
      bankTranId: sslPaid ? `SEEDBANK${number}` : null,
      valId: sslPaid ? `SEEDVAL${number}` : null,
      // SSLCommerz reports its fee (amount − store_amount) and the card used.
      feeCents: sslPaid ? Math.round(total * 0.025) : null,
      cardBrand: sslPaid ? pick(["VISA", "MASTERCARD", "AMEX"]) : null,
      cardIssuer: sslPaid ? pick(["BRAC Bank", "City Bank", "Dutch-Bangla Bank", "Eastern Bank"]) : null,
      failReason: status === "FAILED" ? "Payment declined" : null,
      completedAt: paidAt ?? (status === "CANCELLED" || status === "FAILED" || status === "EXPIRED" ? (steps.at(-1)?.createdAt ?? null) : null),
      raw: paid && method !== "COD" ? [{ at: (paidAt ?? createdAt).toISOString(), tag: method === "BKASH" ? "[bkash]" : "[sslcommerz]", event: "mark-paid:paid" }] : [],
      createdAt: new Date(Math.min(createdAt.getTime() + retries * 4 * 60_000, now - 60_000)),
    } satisfies Prisma.PaymentCreateManyInput;
    payments.push(finalPayment);

    for (const h of steps) history.push({ id: randomUUID(), orderId: id, ...h });
    if (refunded) {
      const at = new Date(Math.min((steps.at(-1)?.createdAt ?? createdAt).getTime() + 3 * 3_600_000, now - 30_000));
      const actorId = pick(staff);
      // Ledger row (negative) + the Refund that points to it.
      const paymentId = randomUUID();
      payments.push({
        id: paymentId,
        orderId: id,
        userId: who.userId,
        type: "REFUND",
        method,
        attempt: null,
        reference: `${orderNumber}-R1`,
        amountCents: -total,
        status: "SUCCEEDED",
        completedAt: at,
        createdAt: at,
      });
      refunds.push({ id: randomUUID(), orderId: id, amountCents: total, note: `Refunded via ${method === "BKASH" ? "bKash" : "bank transfer"} (seed)`, actorId, paymentId, createdAt: at });
      history.push({ id: randomUUID(), orderId: id, status: null, internal: true, actor: "admin", actorId, note: `Refunded ৳${(total / 100).toFixed(2)} (full)`, createdAt: at });
    }
    if (ageH < 0) throw new Error("order in the future");
    number++;
    return { id, total, orderNumber, finalPayment };
  }

  for (let day = DAYS - 1; day >= 0; day--) {
    const dayStart = now - day * DAY_MS;
    const weekday = new Date(dayStart + 6 * 3_600_000).getUTCDay();
    // Growth over the period, busier Fri/Sat (Bangladesh weekend), some noise.
    const base = 6 + (DAYS - day) * 0.075;
    const weekend = weekday === 5 || weekday === 6 ? 1.35 : 1;
    const count = Math.max(2, Math.round(base * weekend * (0.75 + rand() * 0.5)));

    const placed: Date[] = [];
    for (let k = 0; k < count; k++) placed.push(new Date(Math.min(dayStart - int(0, 22 * 60) * 60_000, now - 5 * 60_000)));
    placed.sort((a, b) => a.getTime() - b.getTime());

    // Risky customers: two cancelled COD orders early on, then more COD orders (flagged).
    if (day === 75 || day === 60) for (const c of risky) add(new Date(dayStart - int(60, 600) * 60_000), "COD", "CANCELLED", whoOf(c), { cancelReason: "Customer didn't pick up the phone" });

    for (const createdAt of placed) {
      const ageH = (now - createdAt.getTime()) / 3_600_000;
      const method: Method = pick(["COD", "COD", "COD", "COD", "BKASH", "BKASH", "BKASH", "SSLCOMMERZ", "SSLCOMMERZ"] as const);
      const who = day < 40 && day % 9 === 0 && method === "COD" && rand() < 0.5 ? whoOf(pick(risky)) : randomWho();
      const r = rand();

      let status: Status;
      if (ageH < 0.4 && method !== "COD" && r < 0.5) status = "PENDING_PAYMENT";
      else if (ageH < 30 && r < 0.45) status = method === "COD" ? "PENDING_CONFIRMATION" : "PROCESSING";
      else if (ageH < 48 && r < 0.75) status = method === "COD" && r < 0.55 ? "PENDING_CONFIRMATION" : "PROCESSING";
      else if (ageH < 96 && r < 0.6) status = "SHIPPED";
      // COD cancellations come from one-off guest phones (risky customers above), so only a few phones get flagged.
      else if (r < 0.08 && (method !== "COD" || who.userId === null)) status = "CANCELLED";
      else if (r < 0.12 && method !== "COD") status = "EXPIRED";
      else if (r < 0.14 && method !== "COD") status = "FAILED";
      else if (r > 0.975 && ageH > 96) status = "RETURNED";
      else status = ageH < 72 ? "SHIPPED" : "DELIVERED";

      const retries = method !== "COD" && rand() < 0.06 ? int(1, 2) : 0;
      // Paid online orders that were cancelled or returned were refunded in full.
      const refund = method !== "COD" && (status === "RETURNED" || (status === "CANCELLED" && rand() < 0.3));
      add(createdAt, method, status, who, { retries, refund });
    }
  }

  // Fixtures: every status × payment method exists at least twice (recent, so the
  // tabs and filters have something to show), including multi-attempt payments.
  const have = new Map<string, number>();
  for (const o of orders) have.set(`${o.status}:${o.paymentMethod}`, (have.get(`${o.status}:${o.paymentMethod}`) ?? 0) + 1);
  const COMBOS: [Status, Method[]][] = [
    ["PENDING_PAYMENT", ["BKASH", "SSLCOMMERZ"]],
    ["PENDING_CONFIRMATION", ["COD"]],
    ["PROCESSING", ["COD", "BKASH", "SSLCOMMERZ"]],
    ["SHIPPED", ["COD", "BKASH", "SSLCOMMERZ"]],
    ["DELIVERED", ["COD", "BKASH", "SSLCOMMERZ"]],
    ["CANCELLED", ["COD", "BKASH", "SSLCOMMERZ"]],
    ["EXPIRED", ["BKASH", "SSLCOMMERZ"]],
    ["FAILED", ["BKASH", "SSLCOMMERZ"]],
    ["RETURNED", ["COD", "BKASH", "SSLCOMMERZ"]],
  ];
  const AGE_MIN: Record<Status, number> = {
    PENDING_PAYMENT: 8,
    PENDING_CONFIRMATION: 90,
    PROCESSING: 6 * 60,
    SHIPPED: 30 * 60,
    DELIVERED: 4 * 24 * 60,
    CANCELLED: 2 * 24 * 60,
    EXPIRED: 26 * 60,
    FAILED: 20 * 60,
    RETURNED: 5 * 24 * 60,
  };
  for (const [status, methods] of COMBOS) {
    for (const method of methods) {
      for (let n = have.get(`${status}:${method}`) ?? 0; n < 2; n++) {
        const createdAt = new Date(now - (AGE_MIN[status] + int(0, 60)) * 60_000);
        add(createdAt, method, status, method === "COD" && status === "CANCELLED" ? { ...randomWho(), userId: null, email: `guest.${number}@example.com` } : randomWho(), {
          retries: method === "COD" ? 0 : n === 0 && (status === "PROCESSING" || status === "FAILED") ? 2 : 0,
          refund: method !== "COD" && (status === "RETURNED" || (status === "CANCELLED" && n === 0)),
        });
      }
    }
  }
  // Flagged COD orders waiting for confirmation right now (risky phones).
  for (const c of risky.slice(0, 2)) add(new Date(now - int(20, 200) * 60_000), "COD", "PENDING_CONFIRMATION", whoOf(c));

  // "Needs attention" fixtures (lib/payments/attention.ts), one per rule.
  {
    // 1. A bKash attempt still PENDING 2 hours later (the callback never arrived).
    const stuck = add(new Date(now - 120 * 60_000), "BKASH", "PENDING_PAYMENT", randomWho());
    Object.assign(stuck.finalPayment, { status: "PENDING", paymentId: `SEEDPAY${stuck.orderNumber}` });
    // 2. Paid by bKash, then cancelled by staff, and not refunded yet.
    add(new Date(now - 26 * 3_600_000), "BKASH", "CANCELLED", randomWho(), { paidNoRefund: true, cancelReason: "Out of stock" });
    // 3. SSLCommerz charged ৳50 less than the order total.
    const short = add(new Date(now - 9 * 3_600_000), "SSLCOMMERZ", "PROCESSING", randomWho());
    short.finalPayment.amountCents = short.total - 5000;
    // 4. Two successful bKash charges for one order (double tap / retried callback).
    const dup = add(new Date(now - 5 * 3_600_000), "BKASH", "PROCESSING", randomWho());
    const at = new Date((dup.finalPayment.completedAt ?? new Date(now - 4 * 3_600_000)).getTime() + 40_000);
    payments.push({
      ...dup.finalPayment,
      id: randomUUID(),
      attempt: (dup.finalPayment.attempt ?? 1) + 1,
      reference: `${dup.orderNumber}-${(dup.finalPayment.attempt ?? 1) + 1}`,
      trxId: `SEEDDUP${dup.orderNumber.slice(-5)}`,
      completedAt: at,
      createdAt: new Date(at.getTime() - 60_000),
    });
  }

  const chunk = <T>(xs: T[], n = 500) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  for (const c of chunk(orders)) await prisma.order.createMany({ data: c });
  for (const c of chunk(items)) await prisma.orderItem.createMany({ data: c });
  for (const c of chunk(payments)) await prisma.payment.createMany({ data: c });
  for (const c of chunk(history, 1000)) await prisma.orderStatusHistory.createMany({ data: c });
  if (refunds.length) await prisma.refund.createMany({ data: refunds });
  for (const [variantId, qty] of reserve) {
    await prisma.variant.update({ where: { id: variantId }, data: { reserved: { increment: qty } } });
  }
  return {
    customers: customers.length,
    orders: orders.length,
    flagged: orders.filter((o) => o.codFlagged).length,
    multiAttempt: new Set(payments.filter((p) => (p.attempt ?? 0) > 1).map((p) => p.orderId)).size,
    refunds: refunds.length,
  };
}

const COURIERS = ["Pathao", "Steadfast", "RedX", "Sundarban", "eCourier"];
const CUSTOMER_CANCEL = ["Changed my mind", "Ordered by mistake", "Found a better price"];
const STAFF_CANCEL = ["Customer asked to cancel", "Couldn't reach the customer", "Out of stock"];

function timeline(
  status: Status,
  method: Method,
  placed: Date,
  now: number,
  staff: string[],
  pick: <T>(xs: readonly T[]) => T,
  { cancelReason, paidBeforeCancel }: { cancelReason?: string; paidBeforeCancel?: boolean } = {},
) {
  const at = (min: number) => new Date(Math.min(placed.getTime() + min * 60_000, now));
  const cod = method === "COD";
  const admin = () => ({ actor: "admin", actorId: pick(staff) });
  const rows: { status: Status; note: string; actor: string; actorId?: string | null; createdAt: Date }[] = [
    {
      status: cod ? "PENDING_CONFIRMATION" : "PENDING_PAYMENT",
      note: cod ? "Placed with Cash on Delivery" : "Placed, waiting for payment",
      actor: "customer",
      createdAt: at(0),
    },
  ];
  const step = (["PROCESSING", "SHIPPED", "DELIVERED", "RETURNED"] as const).indexOf(status as "PROCESSING");
  if (step >= 0) rows.push({ status: "PROCESSING", note: cod ? "Order confirmed" : "Paid online", ...(cod ? admin() : { actor: "system" }), createdAt: at(90) });
  if (step >= 1) rows.push({ status: "SHIPPED", note: "Handed to the courier", ...admin(), createdAt: at(20 * 60) });
  if (step >= 2) rows.push({ status: "DELIVERED", note: cod ? "Delivered · cash collected" : "Delivered", ...admin(), createdAt: at(44 * 60) });
  if (step >= 3) rows.push({ status: "RETURNED", note: "Returned: damaged on arrival", ...admin(), createdAt: at(68 * 60) });
  if (status === "CANCELLED") {
    // Pending orders: the customer cancels; paid online orders: staff cancel them.
    if (paidBeforeCancel) {
      rows.push({ status: "PROCESSING", note: "Paid online", actor: "system", createdAt: at(5) });
      rows.push({ status, note: cancelReason ?? pick(STAFF_CANCEL), ...admin(), createdAt: at(240) });
    } else if (cancelReason || cod || pick([true, false])) {
      rows.push({ status, note: cancelReason ?? pick(STAFF_CANCEL), ...admin(), createdAt: at(120) });
    } else {
      rows.push({ status, note: pick(CUSTOMER_CANCEL), actor: "customer", createdAt: at(120) });
    }
  }
  if (status === "FAILED") rows.push({ status, note: "Payment declined", actor: "system", createdAt: at(8) });
  if (status === "EXPIRED") rows.push({ status, note: "Unpaid after 30 minutes", actor: "system", createdAt: at(30) });
  return rows;
}
