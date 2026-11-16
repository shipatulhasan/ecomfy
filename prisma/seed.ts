/**
 * Dev seed — data mirrors the design screenshots (designs/screens).
 * Run: pnpm db:seed  (copies designs/assets → public/seed first)
 *
 * Idempotent: TRUNCATEs every app table, then inserts. Refuses to run in production.
 * Product images are uploaded through lib/storage into THIS Neon branch's bucket
 * ("uploads": products/{productId}/{uuid}.png); the bucket's products/, media/
 * and tmp/ folders are emptied first.
 * Users are inserted directly (User + credential Account) with passwords hashed by
 * Better Auth's own hashPassword, so they can sign in through the normal flow.
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import sharp from "sharp";
import { PrismaClient, type Prisma } from "../lib/generated/prisma/client";
import { derivePrice, UNLIMITED_STOCK } from "../lib/admin/products/rules";
import { neonStorage, storageKeys } from "../lib/storage/core";
import { hashInviteToken, inviteExpiry, inviteUrl, newInviteToken } from "../lib/admin/invites";
import { seedDashboard } from "./seed-dashboard";
import { categories, chineseCabbageReviews, products, REVIEW_BODIES, slugify, type SeedProduct, type SeedVariant } from "./seed-data";

if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed a production database.");
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("Set DATABASE_URL (and DIRECT_URL) in .env first.");
// Admin / staff accounts use SEED_PASSWORD; every customer account uses CUSTOMER_PASSWORD.
const password = process.env.SEED_PASSWORD;
if (!password || password.length < 8) {
  throw new Error("Set SEED_PASSWORD (8+ chars) in .env — used for the seeded admin and staff accounts.");
}
const customerPassword = process.env.CUSTOMER_PASSWORD;
if (!customerPassword || customerPassword.length < 8) {
  throw new Error("Set CUSTOMER_PASSWORD (8+ chars) in .env — used for every seeded customer account.");
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

// ───────────────────────── storage ─────────────────────────

/** Empties the folders the app writes to in this branch's bucket. */
async function resetBucket() {
  const keys: string[] = [];
  for (const prefix of ["products/", "media/", "tmp/"]) for await (const o of neonStorage.list(prefix)) keys.push(o.key);
  await neonStorage.delete(keys);
  return keys.length;
}

/** Uploads one manifest crop for a product and creates its Media row (with blur). */
async function uploadProductImage(productId: string, assetSlug: string, alt: string): Promise<string> {
  const a = asset("products", assetSlug);
  const file = await readFile(resolve(import.meta.dirname, "../designs/assets", a.url.replace(/^\/seed\//, "")));
  const key = storageKeys.product(productId, randomUUID(), "png");
  const blur = await sharp(file).resize(16, 16, { fit: "inside" }).webp({ quality: 40 }).toBuffer();
  await neonStorage.put(key, file, "image/png");
  const media = await prisma.media.create({
    data: {
      key,
      url: neonStorage.publicUrl(key),
      originalName: `${assetSlug}.png`,
      mime: "image/png",
      size: file.length,
      width: a.width,
      height: a.height,
      alt,
      blurDataURL: `data:image/webp;base64,${blur.toString("base64")}`,
    },
    select: { id: true },
  });
  return media.id;
}

/** Variant prices: regular/sale + the derived selling price for the product's sale window. */
function variantPrices(price: number, compareAt: number | undefined, window: { saleStartsAt: Date | null; dealEndsAt: Date | null }) {
  const regularPriceCents = cents(compareAt ?? price);
  const salePriceCents = compareAt ? cents(price) : null;
  return { regularPriceCents, salePriceCents, ...derivePrice({ regularPriceCents, salePriceCents }, window) };
}

/** PDP Additional Information rows for products that don't list their own. */
function defaultAttributes(p: SeedProduct, v: SeedVariant) {
  const rows: { name: string; value: string }[] = [];
  if (v.weightGrams) rows.push({ name: "Weight", value: v.weightGrams >= 1000 ? `${v.weightGrams / 1000} kg` : `${v.weightGrams} g` });
  if (p.color) rows.push({ name: "Color", value: p.color });
  if (p.productType) rows.push({ name: "Type", value: p.productType });
  return rows;
}
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000);

/**
 * OrderStatusHistory rows for a seeded order: the status it was placed in, then
 * every step up to its final status (Order Details tracker dates and banners).
 */
type HistoryRow = Prisma.OrderStatusHistoryCreateWithoutOrderInput;

function statusTimeline(final: HistoryRow["status"], method: Prisma.OrderCreateInput["paymentMethod"], placed: Date) {
  const at = (minutes: number) => new Date(Math.min(placed.getTime() + minutes * 60_000, Date.now()));
  const cod = method === "COD";
  const label = method === "BKASH" ? "bKash" : method === "SSLCOMMERZ" ? "Card / Online Banking" : "Cash on Delivery";
  type Row = HistoryRow;
  const row = (status: HistoryRow["status"], note: string, minutes: number, actor = "system"): Row => ({
    status,
    note,
    actor,
    createdAt: at(minutes),
  });
  const rows: Row[] = [
    row(cod ? "PENDING_CONFIRMATION" : "PENDING_PAYMENT", cod ? "Placed with Cash on Delivery" : "Placed, waiting for payment", 0, "customer"),
  ];
  const step = (["PROCESSING", "SHIPPED", "DELIVERED"] as const).indexOf(final as "PROCESSING");
  if (step >= 0) rows.push(row("PROCESSING", cod ? "Confirmed by the store" : `Paid via ${label}`, 120, cod ? "admin" : "system"));
  if (step >= 1) rows.push(row("SHIPPED", "Handed to the courier", 24 * 60, "admin"));
  if (step >= 2) rows.push(row("DELIVERED", cod ? "Delivered, paid in cash" : "Delivered", 48 * 60, "admin"));
  if (final === "CANCELLED") rows.push(row("CANCELLED", "Cancelled by customer", 180, "customer"));
  if (final === "FAILED") rows.push(row("FAILED", "Payment declined by the bank", 10));
  if (final === "EXPIRED") rows.push(row("EXPIRED", "Unpaid after 30 minutes", 30));
  return rows;
}

// ───────────────────────── users ─────────────────────────

type SeedUser = {
  key: string;
  name: string;
  email: string;
  role?: "ADMIN" | "STAFF" | "CUSTOMER";
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
  // Dev fixture only: production bootstraps its first admin with `pnpm admin:create`.
  { key: "admin", name: "Wade Warren", email: "admin@ecomfy.test", role: "ADMIN", phone: "01711000120", createdDaysAgo: 400 },
  // STAFF: orders, products, categories, customers; no coupons / transactions / settings / members.
  { key: "staff", name: "Olivia Rhye", email: "staff@ecomfy.test", role: "STAFF", phone: "01711000121", createdDaysAgo: 120 },
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
    TRUNCATE "AuditLog", "AdminInvite", "OrderStatusHistory", "Payment", "OrderItem", "Order", "Settings", "ShippingZone", "GatewayToken", "CartItem", "Cart", "Wishlist", "Review", "ProductAttribute",
             "ProductImage", "Media", "SlugRedirect", "Variant", "Product", "Category", "Address", "Coupon",
             "Session", "Account", "Verification", "User"
    RESTART IDENTITY CASCADE`);
}

async function seedUsers() {
  const [staffHash, customerHash] = await Promise.all([hashPassword(password!), hashPassword(customerPassword!)]);
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
          create: { id: randomUUID(), accountId: id, providerId: "credential", password: u.role === "ADMIN" || u.role === "STAFF" ? staffHash : customerHash, createdAt },
        },
      },
    });
  }
  return ids;
}

// ───────────────────────── catalog ─────────────────────────

/**
 * Size × Color variants with per-variant images (admin Variants + image→variant
 * assignment): Bell Pepper Mix, Red/Green × 500 g/1 kg.
 */
async function seedVariantShowcase(categoryId: string) {
  const id = randomUUID();
  const window = { saleStartsAt: null, dealEndsAt: null };
  const combos = ["Red", "Green"].flatMap((color) =>
    ["500 g", "1 kg"].map((size) => ({ color, size, price: size === "1 kg" ? 12.5 : 6.9, stock: color === "Red" ? 4 : 60 })),
  );
  await prisma.product.create({
    data: {
      id,
      name: "Bell Pepper Mix",
      slug: "bell-pepper-mix",
      sku: "BPM-001",
      status: "PUBLISHED",
      description: "<p>Crunchy bell peppers, picked ripe. Choose a colour and a pack size.</p>",
      shortDescription: "Red or green bell peppers in two pack sizes.",
      brand: "Green Valley",
      productType: "Organic",
      tags: ["Healthy", "Vegetarian"],
      priceCents: cents(combos[0]!.price),
      categoryId,
      attributes: { create: [{ name: "Type", value: "Organic", sortOrder: 0 }] },
      variants: {
        create: combos.map((c, i) => ({
          sku: `BPM-${c.color.toUpperCase()}-${c.size.replace(/\s+/g, "").toUpperCase()}`,
          name: `${c.color} / ${c.size}`,
          size: c.size,
          color: c.color,
          weightGrams: c.size === "1 kg" ? 1000 : 500,
          ...variantPrices(c.price, i === 1 ? 14.9 : undefined, window),
          stock: c.stock,
          isDefault: i === 0,
        })),
      },
    },
  });
  const variants = await prisma.variant.findMany({ where: { productId: id }, select: { id: true, color: true, size: true } });
  const shots: [asset: string, color: string | null][] = [
    ["red-capsicum", "Red"],
    ["green-capsicum", "Green"],
    ["red-chili", null],
  ];
  for (const [sortOrder, [shot, color]] of shots.entries()) {
    const mediaId = await uploadProductImage(id, shot, `Bell Pepper Mix, ${color ?? "detail"}`);
    const variant = color ? variants.find((v) => v.color === color && v.size === "1 kg") : null;
    await prisma.productImage.create({ data: { productId: id, mediaId, sortOrder, variantId: variant?.id ?? null } });
  }
}

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

  const handWritten = products.findIndex((p) => p.name === "Organic Green Apple"); // padded() starts here
  for (const [i, p] of products.entries()) {
    const slug = slugify(p.name);
    const defaultVariant = p.variants.find((v) => v.isDefault) ?? p.variants[0]!;
    const sku = String(21231 + i).padStart(6, "0"); // admin Product List shows "021231"
    const id = randomUUID();

    // Admin list variety (padded products only; the hand-written ones are on the design screens).
    const j = handWritten >= 0 && i >= handWritten ? i - handWritten : -1;
    const status = j % 10 === 3 ? "DRAFT" : j % 10 === 7 ? "ARCHIVED" : "PUBLISHED";
    const untracked = j >= 0 && j % 9 === 4;
    const lowStock = j >= 0 && j % 5 === 2;
    const window = {
      saleStartsAt: j === 5 ? new Date(Date.now() + 2 * 86_400_000) : null, // scheduled sale, not started yet
      dealEndsAt: p.dealDays ? new Date(Date.now() + p.dealDays * 86_400_000) : null,
    };
    const multi = p.variants.length > 1;
    const variants = p.variants.map((v, vi) => ({
      sku: vi === 0 && p.sku ? p.sku : `${sku}-${slugify(v.name)}`,
      name: v.name,
      size: multi ? v.name : null,
      weightGrams: v.weightGrams,
      color: p.color,
      ...variantPrices(v.price, v.compareAt, window),
      stock: untracked ? UNLIMITED_STOCK : lowStock ? 2 + vi : v.stock,
      isDefault: v.isDefault ?? vi === 0,
    }));

    await prisma.product.create({
      data: {
        id,
        name: p.name,
        slug,
        sku,
        status,
        trackInventory: !untracked,
        shortDescription: p.shortDescription,
        description: p.description!,
        brand: p.brand,
        productType: p.productType,
        tags: p.tags ?? [],
        videoUrl: p.videoUrl,
        videoPosterUrl: p.videoUrl ? asset("banners", "pdp-video").url : null,
        seoTitle: slug === "chinese-cabbage" ? "Chinese Cabbage, fresh & organic | Ecobazar" : null,
        seoDescription: slug === "chinese-cabbage" ? "Crisp organic Chinese cabbage from Farmary, delivered fresh." : null,
        attributes: {
          create: (p.attributes ?? defaultAttributes(p, defaultVariant)).map((a, sortOrder) => ({ ...a, sortOrder })),
        },
        isFeatured: p.isFeatured ?? false,
        ...window,
        priceCents: variants.find((v) => v.isDefault)!.priceCents, // denormalized for Shop sort/filter
        categoryId: categoryIds[p.category]!,
        createdAt: daysAgo(90 - i),
        variants: { create: variants },
      },
    });
    // Main image first, then the gallery (PDP / Quick View thumbnails) in order.
    const shots = [p.image ?? slug, ...(p.gallery ?? [])];
    const mediaIds = await Promise.all(shots.map((s, n) => uploadProductImage(id, s, n === 0 ? p.name : `${p.name}, view ${n + 1}`)));
    await prisma.productImage.createMany({ data: mediaIds.map((mediaId, sortOrder) => ({ productId: id, mediaId, sortOrder })) });

    const product = await prisma.product.findUniqueOrThrow({ where: { id }, include: { variants: true, images: { orderBy: { sortOrder: "asc" }, take: 1, include: { media: true } } } });
    catalog[slug] = {
      id: product.id,
      name: product.name,
      image: product.images[0]!.media.url,
      variants: Object.fromEntries(product.variants.map((v) => [v.name, { id: v.id, name: v.name, priceCents: v.priceCents }])),
    };
  }

  await seedVariantShowcase(categoryIds["fresh-vegetables"]!);
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
  console.log(`Emptied bucket folders (${await resetBucket()} objects). Uploading product images…`);

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
        history: { create: statusTimeline(status, opts.paymentMethod!, createdAt) },
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
    // COD is paid in cash on delivery: unpaid until then.
    await order({ number, userKey: "dianne", daysAgo: ago, lines, status, paymentStatus: status === "DELIVERED" ? "PAID" : "UNPAID", paymentMethod: "COD" });
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
  // Every Order Details state: failed online payment (Pay now), expired, paid via bKash (transaction id).
  await order({ number: 9104, userKey: "dianne", daysAgo: 1, lines: [["red-capsicum", "1 kg", 2], ["green-chili", "500 g", 3]], status: "FAILED", paymentStatus: "UNPAID", paymentMethod: "SSLCOMMERZ" });
  await order({ number: 9105, userKey: "dianne", daysAgo: 5, lines: [["fresh-indian-orange", "1 kg", 2]], status: "EXPIRED", paymentStatus: "UNPAID", paymentMethod: "BKASH" });
  await order({ number: 9106, userKey: "dianne", daysAgo: 3, lines: [["green-capsicum", "1 kg", 3], ["corn", "1 kg", 2]], status: "DELIVERED", paymentStatus: "PAID", paymentMethod: "BKASH", trx: "BKA9X2M4Q1" });

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

  // ── Admin: dashboard data, drafts, stock-outs, invites ──
  // Red Chili sells well but is out of stock now (Best selling "Stock out").
  await prisma.variant.updateMany({ where: { productId: catalog["red-chili"]!.id }, data: { stock: 0 } });
  const dash = await seedDashboard(prisma, {
    catalog,
    hash: await hashPassword(customerPassword!),
    couponId: coupon.id,
    outOfStock: ["surjapuri-mango", "red-chili"],
  });
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Order"', 'number'), (SELECT MAX("number") FROM "Order"))`,
  );

  // Drafts for the dashboard's "Add New Product" card.
  const fruit = await prisma.category.findUniqueOrThrow({ where: { slug: "fresh-fruit" }, select: { id: true } });
  const drafts: [name: string, image: string, taka: number][] = [
    ["Green Apple Gift Box", "green-apple", 39.99],
    ["Fresh Mango Family Pack", "fresh-mango", 19.99],
    ["Indian Orange Bulk 5 kg", "fresh-indian-orange", 34.99],
  ];
  for (const [i, [name, image, taka]] of drafts.entries()) {
    const id = randomUUID();
    await prisma.product.create({
      data: {
        id,
        name,
        slug: slugify(name),
        sku: String(30001 + i).padStart(6, "0"),
        description: `<p>${name}, waiting to be published.</p>`,
        status: "DRAFT",
        priceCents: cents(taka),
        categoryId: fruit.id,
        createdAt: new Date(Date.now() - (i + 1) * 3_600_000),
        variants: {
          create: { sku: `DRAFT-${i + 1}`, name: "1 pack", regularPriceCents: cents(taka), priceCents: cents(taka), stock: 50, isDefault: true },
        },
      },
    });
    const mediaId = await uploadProductImage(id, image, name);
    await prisma.productImage.create({ data: { productId: id, mediaId, sortOrder: 0 } });
  }

  // One soft-deleted product that still appears on past orders (admin list hides it).
  const gone = catalog["himsagar-mango"];
  if (gone) await prisma.product.update({ where: { id: gone.id }, data: { deletedAt: new Date(), status: "ARCHIVED" } });

  // Invites: one pending (link printed below), one expired, one already used.
  const origin = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const pending = newInviteToken();
  const expired = newInviteToken();
  await prisma.adminInvite.createMany({
    data: [
      { email: "new.staff@ecomfy.test", firstName: "Nadia", lastName: "Islam", role: "STAFF", tokenHash: pending.tokenHash, invitedById: u.admin!, expiresAt: inviteExpiry() },
      { email: "late.staff@ecomfy.test", firstName: "Rafiq", lastName: "Uddin", role: "STAFF", tokenHash: expired.tokenHash, invitedById: u.admin!, expiresAt: new Date(Date.now() - 3_600_000), createdAt: new Date(Date.now() - 49 * 3_600_000) },
      { email: "staff@ecomfy.test", firstName: "Olivia", lastName: "Rhye", role: "STAFF", tokenHash: hashInviteToken("seed-used-invite-token-olivia"), invitedById: u.admin!, expiresAt: inviteExpiry(daysAgo(120)), acceptedAt: daysAgo(120), acceptedUserId: u.staff!, createdAt: daysAgo(121) },
    ],
  });
  await prisma.auditLog.createMany({
    data: [
      { actorId: u.admin!, action: "invite.create", entity: "AdminInvite", after: { email: "staff@ecomfy.test", role: "STAFF" }, createdAt: daysAgo(121) },
      { actorId: u.staff!, action: "invite.accept", entity: "AdminInvite", after: { email: "staff@ecomfy.test", role: "STAFF" }, createdAt: daysAgo(120) },
      { actorId: u.admin!, action: "invite.create", entity: "AdminInvite", after: { email: "new.staff@ecomfy.test", role: "STAFF" } },
    ],
  });

  // Denormalized rating fields used by product cards.
  const stats = await prisma.review.groupBy({ by: ["productId"], _avg: { rating: true }, _count: true });
  for (const s of stats) {
    await prisma.product.update({
      where: { id: s.productId },
      data: { ratingAvg: Math.round((s._avg.rating ?? 0) * 10) / 10, reviewCount: s._count },
    });
  }

  const orderCount = await prisma.order.count();
  console.log(`✔ dashboard: ${dash.customers} customers, ${dash.orders} orders over 90 days, 3 draft products, Red Chili out of stock`);
  console.log(`✔ ${orderCount} orders, 1 cart (4 lines), 4 wishlist items, ${chineseCabbageReviews.length + extra.length} reviews, coupons ECO20 / EXPIRED10 / BIG50`);
  console.log(`✔ settings (COD ৳20 fee, ৳20,000 max, no COD in ${noCod.join(" / ")}), zones Inside Dhaka ৳60 / Outside Dhaka ৳120`);
  console.log("\nDemo accounts (passwords come from .env, not printed):");
  console.table([
    { role: "admin (/admin/login)", email: "admin@ecomfy.test", password: "SEED_PASSWORD" },
    { role: "staff (/admin/login)", email: "staff@ecomfy.test", password: "SEED_PASSWORD" },
    { role: "customer (orders, cart, wishlist)", email: "dianne.russell@ecomfy.test", password: "CUSTOMER_PASSWORD" },
    { role: "customer (email not verified)", email: "arif.hossain@ecomfy.test", password: "CUSTOMER_PASSWORD" },
  ]);

  // Spot-check numbers for the dashboard (compare with psql / the widgets).
  const paid = await prisma.order.aggregate({ where: { paymentStatus: "PAID" }, _sum: { totalCents: true }, _count: true });
  console.log(`\nPAID orders: ${paid._count}, revenue ৳${((paid._sum.totalCents ?? 0) / 100).toFixed(2)} (all time)`);
  console.log("\nAdmin invites:");
  console.log(`  pending  new.staff@ecomfy.test  ${inviteUrl(pending.token, origin)}`);
  console.log(`  expired  late.staff@ecomfy.test ${inviteUrl(expired.token, origin)}`);
  console.log(`  used     staff@ecomfy.test      ${inviteUrl("seed-used-invite-token-olivia", origin)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
