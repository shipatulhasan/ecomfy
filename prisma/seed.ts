/**
 * Dev seed — data mirrors the design screenshots (designs/screens).
 * Run: pnpm db:seed  (copies designs/assets → public/seed first)
 *
 * Idempotent: TRUNCATEs every app table, then inserts. Refuses to run in production.
 * Users are inserted directly (User + credential Account) with passwords hashed by
 * Better Auth's own hashPassword, so they can sign in through the normal flow.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type Prisma } from "../lib/generated/prisma/client";
import { categories, chineseCabbageReviews, products, REVIEW_BODIES, slugify, type SeedProduct, type SeedVariant } from "./seed-data";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed a production database.");
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL (and DIRECT_URL) in .env first.");
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 8) {
  throw new Error("Set SEED_PASSWORD (8+ chars) in .env — used for every seeded account.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Real images cropped from the design PNGs (`pnpm assets:crop` → designs/assets/manifest.json).
type ManifestEntry = { url: string; width: number; height: number };
const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../designs/assets/manifest.json"), "utf8"),
) as Record<"products" | "categories" | "banners" | "avatars", Record<string, ManifestEntry>>;

function asset(group: "products" | "categories" | "banners" | "avatars", slug: string): ManifestEntry {
  const entry = manifest[group][slug];
  if (!entry) throw new Error(`No image for ${group}/${slug} in designs/assets/manifest.json — add it to scripts/crop-assets.ts`);
  return entry;
}

/**
 * Money is BDT poisha. seed-data.ts prices are BDT (taka), stored as poisha.
 * USD is display-only, derived at Settings.usdToBdtRate.
 */
const cents = (taka: number) => Math.round(taka * 100);

/** PDP Additional Information rows for products that don't list their own. */
function defaultAttributes(p: SeedProduct, v: SeedVariant) {
  const rows: { name: string; value: string }[] = [];
  if (v.weightGrams) rows.push({ name: "Weight", value: v.weightGrams >= 1000 ? `${v.weightGrams / 1000} kg` : `${v.weightGrams} g` });
  if (p.color) rows.push({ name: "Color", value: p.color });
  if (p.productType) rows.push({ name: "Type", value: p.productType });
  return rows;
}
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

// ───────────────────────── users ─────────────────────────

type SeedUser = {
  key: string;
  name: string;
  email: string;
  role?: "ADMIN" | "CUSTOMER";
  status?: "ACTIVE" | "INACTIVE" | "VIP";
  phone?: string;
  image?: string;
  createdDaysAgo?: number;
  /** Default true. */
  emailVerified?: boolean;
};

// Admin = "Wade Warren" (admin General Info screen). Customers from the
// User Dashboard, admin Customers table and PDP Customer Feedback.
const users: SeedUser[] = [
  { key: "admin", name: "Wade Warren", email: "admin@ecomfy.test", role: "ADMIN", phone: "01711000120", createdDaysAgo: 400 },
  { key: "dianne", name: "Dianne Russell", email: "dianne.russell@ecomfy.test", phone: "01712555011", createdDaysAgo: 600 },
  { key: "john", name: "John Doe", email: "john.doe@ecomfy.test", phone: "01813000001", createdDaysAgo: 320 },
  { key: "jane", name: "Jane Smith", email: "jane.smith@ecomfy.test", phone: "01913000002", status: "INACTIVE", createdDaysAgo: 280 },
  { key: "emily", name: "Emily Davis", email: "emily.davis@ecomfy.test", phone: "01613000003", status: "VIP", createdDaysAgo: 500 },
  // Signed up but never verified the email (auth flows: verification banner / resend).
  { key: "unverified", name: "Arif Hossain", email: "arif.hossain@ecomfy.test", phone: "01515000004", emailVerified: false, createdDaysAgo: 2 },
  // PDP reviewers: avatars cropped from the Customer Feedback PNG (Jane Cooper has the placeholder).
  { key: "kristin", name: "Kristin Watson", email: "kristin.watson@ecomfy.test", image: asset("avatars", "kristin-watson").url, createdDaysAgo: 200 },
  { key: "janec", name: "Jane Cooper", email: "jane.cooper@ecomfy.test", createdDaysAgo: 190 },
  { key: "jacob", name: "Jacob Jones", email: "jacob.jones@ecomfy.test", image: asset("avatars", "jacob-jones").url, createdDaysAgo: 150 },
  { key: "ralph", name: "Ralph Edwards", email: "ralph.edwards@ecomfy.test", image: asset("avatars", "ralph-edwards").url, createdDaysAgo: 120 },
];

async function reset() {
  // Table names are the Prisma model names (no @@map).
  await prisma.$executeRawUnsafe(`
    TRUNCATE "Payment", "OrderItem", "Order", "Settings", "ShippingZone", "GatewayToken", "CartItem", "Cart", "Wishlist", "Review", "ProductAttribute",
             "ProductImage", "Variant", "Product", "Category", "Address", "Coupon",
             "Session", "Account", "Verification", "User"
    RESTART IDENTITY CASCADE`);
}

async function seedUsers() {
  const hash = await hashPassword(password!);
  const ids: Record<string, string> = {};
  for (const u of users) {
    const id = randomUUID();
    ids[u.key] = id;
    const createdAt = daysAgo(u.createdDaysAgo ?? 30);
    await prisma.user.create({
      data: {
        id,
        name: u.name,
        email: u.email,
        emailVerified: u.emailVerified ?? true,
        role: u.role ?? "CUSTOMER",
        status: u.status ?? "ACTIVE",
        phone: u.phone,
        image: u.image,
        createdAt,
        accounts: {
          create: { id: randomUUID(), accountId: id, providerId: "credential", password: hash, createdAt },
        },
      },
    });
  }
  return ids;
}

// ───────────────────────── catalog ─────────────────────────

async function seedCatalog() {
  const categoryIds: Record<string, string> = {};
  for (const [i, c] of categories.entries()) {
    const row = await prisma.category.create({
      data: { name: c.name, slug: c.slug, sortOrder: i, imageUrl: asset("categories", c.slug).url, createdAt: daysAgo(365) },
    });
    categoryIds[c.slug] = row.id;
  }

  // slug → { productId, variants by name }
  const catalog: Record<string, { id: string; name: string; image: string; variants: Record<string, { id: string; name: string; priceCents: number }> }> = {};

  for (const [i, p] of products.entries()) {
    const slug = slugify(p.name);
    const img = asset("products", p.image ?? slug);
    const defaultVariant = p.variants.find((v) => v.isDefault) ?? p.variants[0]!;
    const image = img.url;
    const code = String(21231 + i).padStart(6, "0"); // admin Product List shows "021231"
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug,
        code,
        shortDescription: p.shortDescription,
        description: p.description!,
        brand: p.brand,
        productType: p.productType,
        tags: p.tags ?? [],
        videoUrl: p.videoUrl,
        videoPosterUrl: p.videoUrl ? asset("banners", "pdp-video").url : null,
        attributes: {
          create: (p.attributes ?? defaultAttributes(p, defaultVariant)).map((a, sortOrder) => ({ ...a, sortOrder })),
        },
        isFeatured: p.isFeatured ?? false,
        priceCents: cents(defaultVariant.price), // denormalized for Shop sort/filter
        dealEndsAt: p.dealDays ? new Date(Date.now() + p.dealDays * 86_400_000) : null,
        categoryId: categoryIds[p.category]!,
        createdAt: daysAgo(90 - i),
        // Main image first, then the gallery (PDP / Quick View thumbnails) in order.
        images: {
          create: [p.image ?? slug, ...(p.gallery ?? [])].map((s, position) => {
            const a = asset("products", s);
            return { url: a.url, alt: position === 0 ? p.name : `${p.name}, view ${position + 1}`, width: a.width, height: a.height, position };
          }),
        },
        variants: {
          create: p.variants.map((v, vi) => ({
            sku: vi === 0 && p.sku ? p.sku : `${code}-${slugify(v.name)}`,
            name: v.name,
            weightGrams: v.weightGrams,
            color: p.color,
            priceCents: cents(v.price),
            compareAtCents: v.compareAt ? cents(v.compareAt) : null,
            stock: v.stock,
            isDefault: v.isDefault ?? vi === 0,
          })),
        },
      },
      include: { variants: true },
    });
    catalog[slug] = {
      id: product.id,
      name: product.name,
      image,
      variants: Object.fromEntries(product.variants.map((v) => [v.name, { id: v.id, name: v.name, priceCents: v.priceCents }])),
    };
  }
  return catalog;
}

// ───────────────────────── orders ─────────────────────────

// Shape of lib/validations/address.ts (Bangladesh-first checkout).
const dianneAddress = {
  firstName: "Dianne",
  lastName: "Russell",
  companyName: "Zakirsoft",
  street: "House 12, Road 5, Block C",
  city: "Banani",
  district: "Dhaka",
  zip: "1213",
  email: "dianne.russell@ecomfy.test",
  phone: "01712555011",
};

function addressFor(name: string, email: string, phone: string) {
  const [firstName = name, lastName = ""] = name.split(" ");
  return { firstName, lastName, street: "45 CDA Avenue", city: "GEC", district: "Chattogram", zip: "4000", email, phone };
}

/** Matches the seeded shipping zones (Dhaka metro vs the rest). */
const INSIDE_DHAKA = ["Dhaka", "Gazipur", "Narayanganj"];
const shippingFor = (district: string) => (INSIDE_DHAKA.includes(district) ? 6000 : 12000);

type Line = [slug: string, variant: string, qty: number];

async function main() {
  console.log("Resetting tables…");
  await reset();

  const u = await seedUsers();
  const catalog = await seedCatalog();
  console.log(`✔ ${users.length} users, ${categories.length} categories, ${products.length} products`);

  // Store settings + shipping zones (lib/queries/settings.ts). Remote hill districts
  // have no COD so "district not allowed" can be tested.
  const { DISTRICTS } = await import("../lib/config/districts");
  const noCod = ["Bandarban", "Rangamati", "Khagrachhari"];
  await prisma.settings.create({
    data: {
      id: "default",
      usdToBdtRate: 123, // display-only USD rate (admin-editable later)
      codEnabled: true,
      codFeeCents: 2000, // ৳20
      codMaxOrderCents: 2_000_000, // ৳20,000
      codAllowedDistricts: DISTRICTS.filter((d) => !noCod.includes(d)),
      codMaxPerPhonePerDay: 3,
      bkashEnabled: true,
      sslcommerzEnabled: true,
    },
  });
  await prisma.shippingZone.createMany({
    data: [
      { name: "Inside Dhaka", rateCents: 6000, districts: INSIDE_DHAKA, etaText: "1–2 days", sortOrder: 0 },
      { name: "Outside Dhaka", rateCents: 12000, districts: [], isFallback: true, etaText: "3–5 days", sortOrder: 1 },
    ],
  });

  const coupon = await prisma.coupon.create({
    data: { code: "ECO20", type: "PERCENT", value: 20, isActive: true },
  });
  // Fixtures for the Shopping Cart coupon errors: expired, and minimum spend not met.
  await prisma.coupon.createMany({
    data: [
      { code: "EXPIRED10", type: "PERCENT", value: 10, endsAt: new Date(Date.now() - 86_400_000) },
      { code: "BIG50", type: "FIXED", value: 5000, minSubtotalCents: 20000 }, // ৳50 off ৳200+
    ],
  });

  await prisma.address.create({ data: { userId: u.dianne!, kind: "BILLING", isDefault: true, ...dianneAddress } });

  async function order(opts: {
    number: number;
    userKey: string;
    daysAgo: number;
    lines: Line[];
    status: Prisma.OrderCreateInput["status"];
    paymentStatus: Prisma.OrderCreateInput["paymentStatus"];
    paymentMethod: Prisma.OrderCreateInput["paymentMethod"];
    withCoupon?: boolean;
    trx?: string;
  }) {
    const user = users.find((x) => x.key === opts.userKey)!;
    const address = opts.userKey === "dianne" ? dianneAddress : addressFor(user.name, user.email, user.phone ?? "+1234567890");
    const items = opts.lines.map(([slug, variantName, qty]) => {
      const p = catalog[slug];
      const v = p?.variants[variantName];
      if (!p || !v) throw new Error(`Seed order references unknown ${slug} / ${variantName}`);
      return {
        variantId: v.id,
        productName: p.name,
        variantName: v.name,
        imageUrl: p.image,
        unitPriceCents: v.priceCents,
        quantity: qty,
        subtotalCents: v.priceCents * qty,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.subtotalCents, 0);
    const discount = opts.withCoupon ? Math.round(subtotal * 0.2) : 0;
    const shipping = shippingFor(address.district);
    const codFee = opts.paymentMethod === "COD" ? 2000 : 0;
    const total = subtotal - discount + shipping + codFee;
    const status = opts.status ?? "PENDING_CONFIRMATION";
    // Open orders hold stock (Variant.reserved); finished ones took it or gave it back.
    const stockState =
      status === "PENDING_PAYMENT" || status === "PENDING_CONFIRMATION"
        ? "RESERVED"
        : status === "CANCELLED" || status === "FAILED" || status === "EXPIRED"
          ? "RELEASED"
          : "COMMITTED";
    const orderNumber = `ECF-${String(opts.number).padStart(6, "0")}`;
    const paid = opts.paymentStatus === "PAID";
    const createdAt = daysAgo(opts.daysAgo);
    await prisma.order.create({
      data: {
        number: opts.number,
        orderNumber,
        idempotencyKey: `seed-${opts.number}`,
        userId: u[opts.userKey]!,
        email: address.email,
        phone: address.phone,
        billingAddress: address,
        shippingAddress: address,
        district: address.district,
        status,
        paymentStatus: opts.paymentStatus,
        paymentMethod: opts.paymentMethod,
        subtotalCents: subtotal,
        discountCents: discount,
        shippingCents: shipping,
        codFeeCents: codFee,
        totalCents: total,
        displayTotalCents: total,
        shippingZoneName: INSIDE_DHAKA.includes(address.district) ? "Inside Dhaka" : "Outside Dhaka",
        deliveryEstimate: INSIDE_DHAKA.includes(address.district) ? "1–2 days" : "3–5 days",
        stockState,
        expiresAt: status === "PENDING_PAYMENT" ? new Date(Date.now() + 25 * 60_000) : null,
        paidAt: paid ? createdAt : null,
        couponId: opts.withCoupon ? coupon.id : null,
        couponCode: opts.withCoupon ? coupon.code : null,
        createdAt,
        items: { create: items },
        payments: {
          create: {
            method: opts.paymentMethod!,
            attempt: 1,
            reference: orderNumber,
            amountCents: total,
            status: paid
              ? "SUCCEEDED"
              : status === "CANCELLED"
                ? "CANCELLED"
                : status === "FAILED" || opts.paymentStatus === "FAILED"
                  ? "FAILED"
                  : opts.paymentMethod === "COD"
                    ? "PENDING"
                    : "INITIATED",
            trxId: paid && opts.paymentMethod === "BKASH" ? (opts.trx ?? `SEED${opts.number}`) : null,
            bankTranId: paid && opts.paymentMethod === "SSLCOMMERZ" ? (opts.trx ?? `SEEDBANK${opts.number}`) : null,
            completedAt: paid ? createdAt : null,
            createdAt,
          },
        },
      },
    });
    if (stockState === "RESERVED") {
      for (const i of items) await prisma.variant.update({ where: { id: i.variantId }, data: { reserved: { increment: i.quantity } } });
    }
  }

  // Dianne's Order History (order numbers from the screen; totals computed from lines).
  // #4152 matches Order Details: Red Capsicum ×5, Green Capsicum ×2, Green Chili ×10, 20% off, PayPal.
  const dianneOrders: [number, number, Line[], "PROCESSING" | "SHIPPED" | "DELIVERED"][] = [
    [3933, 2, [["green-apple", "1 kg", 2], ["corn", "1 kg", 1], ["eggplant", "1 kg", 2]], "PROCESSING"],
    [5045, 9, [["green-lettuce", "1 kg", 1]], "SHIPPED"],
    [5028, 16, [["big-potatoes", "1 kg", 4], ["fresh-cauliflower", "1 kg", 2], ["red-tomatoes", "1 kg", 3], ["corn", "500 g", 2]], "DELIVERED"],
    [4600, 17, [["green-chili", "1 kg", 1]], "DELIVERED"],
    [8811, 26, [["chinese-cabbage", "1 kg", 3], ["ladies-finger", "1 kg", 4]], "DELIVERED"],
    [3536, 31, [["fresh-indian-malta", "1 kg", 6], ["green-apple", "1 kg", 4]], "DELIVERED"],
    [1374, 38, [["eggplant", "1 kg", 5], ["fresh-indian-orange", "1 kg", 3]], "DELIVERED"],
    [7791, 40, [["green-capsicum", "1 kg", 10], ["red-chili", "1 kg", 2]], "DELIVERED"],
    [4846, 41, [["red-tomatoes", "500 g", 1]], "DELIVERED"],
    [5948, 45, [["green-lettuce", "500 g", 2]], "DELIVERED"],
    [1577, 175, [["corn", "1 kg", 1]], "DELIVERED"],
  ];
  for (const [number, ago, lines, status] of dianneOrders) {
    await order({ number, userKey: "dianne", daysAgo: ago, lines, status, paymentStatus: "PAID", paymentMethod: "COD" });
  }
  await order({
    number: 4152,
    userKey: "dianne",
    daysAgo: 18,
    lines: [["red-capsicum", "1 kg", 5], ["green-capsicum", "1 kg", 2], ["green-chili", "500 g", 10]],
    status: "PROCESSING",
    paymentStatus: "PAID",
    paymentMethod: "SSLCOMMERZ",
    withCoupon: true,
  });

  // Open / cancelled orders for the account Order History (2 pages of 12).
  await order({ number: 9101, userKey: "dianne", daysAgo: 0, lines: [["green-apple", "1 kg", 2]], status: "PENDING_PAYMENT", paymentStatus: "UNPAID", paymentMethod: "BKASH" });
  await order({ number: 9102, userKey: "dianne", daysAgo: 1, lines: [["corn", "1 kg", 3], ["red-tomatoes", "1 kg", 1]], status: "PENDING_CONFIRMATION", paymentStatus: "UNPAID", paymentMethod: "COD" });
  await order({ number: 9103, userKey: "dianne", daysAgo: 12, lines: [["eggplant", "1 kg", 2]], status: "CANCELLED", paymentStatus: "UNPAID", paymentMethod: "COD" });

  // Admin Order Management / Transaction mix (Paid/Unpaid; bKash, card/bank, COD; open/done/cancelled).
  const adminMix: Parameters<typeof order>[0][] = [
    { number: 9001, userKey: "john", daysAgo: 1, lines: [["green-apple", "1 kg", 3]], status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "SSLCOMMERZ" },
    { number: 9002, userKey: "john", daysAgo: 2, lines: [["fresh-indian-orange", "1 kg", 6]], status: "PENDING_CONFIRMATION", paymentStatus: "UNPAID", paymentMethod: "COD" },
    { number: 9003, userKey: "jane", daysAgo: 3, lines: [["big-potatoes", "1 kg", 2]], status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "BKASH" },
    { number: 9004, userKey: "emily", daysAgo: 3, lines: [["green-apple", "1 kg", 4], ["eggplant", "500 g", 2]], status: "SHIPPED", paymentStatus: "PAID", paymentMethod: "SSLCOMMERZ" },
    { number: 9005, userKey: "jane", daysAgo: 4, lines: [["corn", "1 kg", 2]], status: "CANCELLED", paymentStatus: "FAILED", paymentMethod: "BKASH" },
    { number: 9006, userKey: "emily", daysAgo: 5, lines: [["red-tomatoes", "1 kg", 5]], status: "PENDING_CONFIRMATION", paymentStatus: "UNPAID", paymentMethod: "COD" },
    { number: 9007, userKey: "john", daysAgo: 6, lines: [["fresh-cauliflower", "1 kg", 2]], status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "BKASH" },
    { number: 9008, userKey: "emily", daysAgo: 6, lines: [["chinese-cabbage", "1 kg", 8]], status: "FAILED", paymentStatus: "FAILED", paymentMethod: "SSLCOMMERZ" },
  ];
  for (const o of adminMix) await order(o);

  // Keep the autoincrement sequence ahead of the explicit order numbers.
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Order"', 'number'), (SELECT MAX("number") FROM "Order"))`,
  );

  // Dianne's cart: the Shopping Cart / Checkout capsicums plus the mini cart's
  // orange and green apple (Shopping_Card_Popup.png). Wishlist: the Wishlist screen's
  // three rows (mango out of stock) plus green apple.
  await prisma.cart.create({
    data: {
      userId: u.dianne!,
      items: {
        create: [
          { variantId: catalog["green-capsicum"]!.variants["1 kg"]!.id, quantity: 5 },
          { variantId: catalog["red-capsicum"]!.variants["1 kg"]!.id, quantity: 1 },
          { variantId: catalog["fresh-indian-orange"]!.variants["1 kg"]!.id, quantity: 1 },
          { variantId: catalog["green-apple"]!.variants["1 kg"]!.id, quantity: 1 },
        ],
      },
    },
  });
  await prisma.wishlist.createMany({
    data: ["green-capsicum", "chinese-cabbage", "surjapuri-mango", "green-apple"].map((slug, i) => ({
      userId: u.dianne!,
      productId: catalog[slug]!.id,
      createdAt: new Date(Date.now() - i * 60_000), // newest first = the PNG's row order
    })),
  });

  // PDP Customer Feedback (Chinese Cabbage) + a few ratings elsewhere for card stars.
  const reviewerKey: Record<string, string> = {
    "Kristin Watson": "kristin",
    "Jane Cooper": "janec",
    "Jacob Jones": "jacob",
    "Ralph Edwards": "ralph",
  };
  for (const r of chineseCabbageReviews) {
    await prisma.review.create({
      data: {
        productId: catalog["chinese-cabbage"]!.id,
        userId: u[reviewerKey[r.reviewer]!]!,
        rating: r.rating,
        body: r.body,
        createdAt: new Date(Date.now() - r.minutesAgo * 60_000),
      },
    });
  }
  // Every other product: one review per entry of its `ratings` (seed-data.ts), so
  // card stars and the Shop rating filter have real data behind them.
  const reviewers = ["kristin", "janec", "jacob", "ralph", "john", "emily", "jane", "dianne"];
  const extra = products.flatMap((p) =>
    (p.ratings ?? []).map((rating, i) => ({
      productId: catalog[slugify(p.name)]!.id,
      userId: u[reviewers[i % reviewers.length]!]!,
      rating,
      body: REVIEW_BODIES[i % REVIEW_BODIES.length]!,
      createdAt: daysAgo(2 + i * 9),
    })),
  );
  await prisma.review.createMany({ data: extra });

  // Denormalized rating fields used by product cards.
  const stats = await prisma.review.groupBy({ by: ["productId"], _avg: { rating: true }, _count: true });
  for (const s of stats) {
    await prisma.product.update({
      where: { id: s.productId },
      data: { ratingAvg: Math.round((s._avg.rating ?? 0) * 10) / 10, reviewCount: s._count },
    });
  }

  const orderCount = await prisma.order.count();
  console.log(`✔ ${orderCount} orders, 1 cart (4 lines), 4 wishlist items, ${chineseCabbageReviews.length + extra.length} reviews, coupons ECO20 / EXPIRED10 / BIG50`);
  console.log(`✔ settings (COD ৳20 fee, ৳20,000 max, no COD in ${noCod.join(" / ")}), zones Inside Dhaka ৳60 / Outside Dhaka ৳120`);
  console.log("\nDemo accounts (password = SEED_PASSWORD from .env):");
  console.table([
    { role: "admin", email: "admin@ecomfy.test", password },
    { role: "customer (orders, cart, wishlist)", email: "dianne.russell@ecomfy.test", password },
    { role: "customer (email not verified)", email: "arif.hossain@ecomfy.test", password },
  ]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
