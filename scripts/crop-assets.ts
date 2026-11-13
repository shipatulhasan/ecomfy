/**
 * Cuts real product / category / banner images out of the 2x design PNGs, using
 * node boxes from designs/raw/metadata.xml (no Figma calls).
 *
 *   pnpm assets:crop
 *
 * Output:
 *   designs/assets/<group>/<slug>.png   (committed; groups listed in ASSET_GROUPS)
 *   designs/assets/manifest.json                              (url + size per slug; read by the seed)
 *   public/seed/...                                           (copy served by next/image)
 *
 * Card instances are leaf nodes in the metadata, so the image area inside each
 * card is given as fractions of the card box (CARD_IMAGE), then trimmed on pixels.
 * Source cards were chosen by eye from a contact sheet: no hover state, and
 * badges erased where unavoidable.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";
import { ASSET_GROUPS, type AssetGroup, syncAssets } from "./sync-assets";

const root = resolve(import.meta.dirname, "..");
const designs = resolve(root, "designs");
const SCALE = 2; // all web screen PNGs are 2x exports
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const MAX_SIDE = 800;

// ───────────────────────── metadata.xml → absolute boxes ─────────────────────────

type Box = { x: number; y: number; w: number; h: number };

/**
 * metadata.xml mixes coordinate frames: some children are relative to their
 * parent, others are absolute within the top-level frame. A child is treated as
 * relative when its box fits inside the parent's size, otherwise as absolute.
 */
function loadBoxes(): Map<string, Box> {
  const xml = readFileSync(resolve(designs, "raw/metadata.xml"), "utf8");
  const boxes = new Map<string, Box>();
  const stack: (Box | null)[] = []; // null = the canvas
  const tag = /<(\/?)([\w-]+)((?:\s+\w+="[^"]*")*)\s*(\/?)>/g;

  for (const m of xml.matchAll(tag)) {
    const [, closing, , attrText = "", selfClosing] = m;
    if (closing) {
      stack.pop();
      continue;
    }
    const attrs = Object.fromEntries(
      [...attrText.matchAll(/(\w+)="([^"]*)"/g)].map((a) => [a[1], a[2]]),
    );
    const [x, y, w, h] = ["x", "y", "width", "height"].map((k) => Number(attrs[k] ?? 0)) as [
      number,
      number,
      number,
      number,
    ];
    const parent = stack.at(-1);
    let box: Box;
    if (!parent) {
      box = { x: 0, y: 0, w, h }; // canvas or top-level frame → its own origin
      if (stack.length === 0) {
        stack.push(null); // canvas
        continue;
      }
    } else {
      const fits = x >= -1 && y >= -1 && x + w <= parent.w + 1 && y + h <= parent.h + 1;
      box = fits ? { x: parent.x + x, y: parent.y + y, w, h } : { x, y, w, h };
    }
    if (attrs.id) boxes.set(attrs.id, box);
    if (!selfClosing) stack.push(box);
  }
  return boxes;
}

// ───────────────────────── crop specs ─────────────────────────

type Rect = [x0: number, y0: number, x1: number, y1: number]; // fractions of the node box

// Image area inside each card component (fractions of the card).
const CARD_IMAGE = {
  category: [0.06, 0.05, 0.94, 0.66], // "Category" 200×213
  card5n: [0.04, 0.02, 0.96, 0.72], // "Product 5n" 264×327
  card4x: [0.04, 0.02, 0.96, 0.72], // "Product 4x" 312×407
  big: [0.03, 0.06, 0.97, 0.56], // "BIG Products" 528×654
  cartRow: [0.005, 0.04, 0.135, 0.96], // "Shoping Cart Product" 832×100
  full: [0, 0, 1, 1],
  pdpMain: [0.16, 0.02, 1, 0.98], // "Product Details Images" 648×556 (thumbnails on the left)
} satisfies Record<string, Rect>;

// Measured badge extents (+ margin for anti-aliasing).
const SALE_BADGE: Rect = [0, 0, 0.4, 0.15]; // "Sale 50%" on Product 5n (ends at 0.362 × 0.130)
const BIG_BADGES: Rect = [0, 0, 0.4, 0.095]; // "Sale 50%" + "Best Sale" on BIG Products (ends at 0.366 × 0.079)
const SALE_BADGE_4X: Rect = [0, 0, 0.34, 0.13]; // "Sale 50%" on Product 4x (312×407)

/**
 * Text baked into a banner, removed so the page can render it live.
 * `box` is [x, y, w, h] in 1x px relative to the node and only bounds the search:
 *   ink  — pixels close to one of these colors (then dilated over anti-aliasing) are text
 *   full — the whole box is text (e.g. a chip drawn over a photo)
 * Masked pixels are rebuilt from the nearest clean pixels, so texture between glyphs survives.
 * `fill: "texture"` mirrors neighbouring pixels instead of interpolating (dark/noisy backgrounds).
 */
type RGB = [r: number, g: number, b: number];
type Clean = {
  box: [x: number, y: number, w: number, h: number];
  ink?: RGB[];
  tol?: number;
  dilate?: number; // px at 2x around each ink pixel (anti-aliasing + soft text shadow)
  /** smooth (default): interpolate — flat/gradient backgrounds. texture: mirror the real texture across each masked run. */
  fill?: "smooth" | "texture";
};

const INK = {
  white: [255, 255, 255],
  orange: [255, 138, 0], // warning token
  green: [0, 178, 7], // primary token
  dark: [25, 25, 25], // foreground token
  gray: [128, 128, 128],
  silver: [204, 204, 204],
  mint: [132, 209, 135], // hero accent bar
} satisfies Record<string, RGB>;

type Spec = {
  slug: string;
  png: string; // file under designs/screens/web
  node: string; // metadata.xml node id (provenance; also the crop box unless `abs` is set)
  abs?: Box; // absolute 1x box on the screen, for areas that are not their own node
  rect: Rect;
  erase?: Rect[];
  clean?: Clean[];
};

const HOME = "Home.png";
const SHOP = "Shop.png";

const categories: Spec[] = [
  ["fresh-fruit", "629:3480"],
  ["fresh-vegetables", "629:3482"],
  ["meat-fish", "629:3484"],
  ["snacks", "629:3486"],
  ["beverages", "629:3487"],
  ["beauty-health", "629:3490"],
  ["bread-bakery", "629:3481"],
  ["baking-needs", "629:3483"],
  ["cooking", "629:3485"],
  ["diabetic-food", "629:3479"],
  ["dish-detergents", "629:3488"],
  ["oil", "629:3489"],
].map(([slug, node]) => ({ slug: slug!, png: HOME, node: node!, rect: CARD_IMAGE.category }));

const products: Spec[] = [
  { slug: "chinese-cabbage", png: "Products_Details_Additional Info.png", node: "PDP_MAIN", rect: CARD_IMAGE.pdpMain },
  // Gallery images 2–4: the PDP thumbnail column ("Product Image Slider" 80×90; thumb 1 = the main image).
  // Only thumbnail-sized sources exist, so these stay small (no upscaling here).
  ...["629:2869", "629:2870", "629:2871"].map((node, i) => ({
    slug: `chinese-cabbage-${i + 2}`,
    png: "Product_Detail_Customer_Feedback.png",
    node,
    rect: CARD_IMAGE.full,
  })),
  { slug: "green-apple", png: HOME, node: "629:3464", rect: CARD_IMAGE.big, erase: [BIG_BADGES] },
  { slug: "fresh-indian-malta", png: HOME, node: "629:3445", rect: CARD_IMAGE.card5n },
  { slug: "corn", png: HOME, node: "629:3470", rect: CARD_IMAGE.card5n },
  { slug: "big-potatoes", png: HOME, node: "629:3471", rect: CARD_IMAGE.card5n },
  { slug: "fresh-cauliflower", png: HOME, node: "629:3472", rect: CARD_IMAGE.card5n },
  { slug: "green-lettuce", png: HOME, node: "629:3473", rect: CARD_IMAGE.card5n },
  { slug: "green-capsicum", png: HOME, node: "629:3474", rect: CARD_IMAGE.card5n, erase: [SALE_BADGE] },
  { slug: "eggplant", png: HOME, node: "629:3475", rect: CARD_IMAGE.card5n },
  { slug: "green-chili", png: HOME, node: "629:3476", rect: CARD_IMAGE.card5n },
  { slug: "red-chili", png: HOME, node: "629:3455", rect: CARD_IMAGE.card5n },
  { slug: "red-tomatoes", png: HOME, node: "629:3460", rect: CARD_IMAGE.card5n, erase: [SALE_BADGE] },
  { slug: "surjapuri-mango", png: HOME, node: "629:3462", rect: CARD_IMAGE.card5n },
  { slug: "ladies-finger", png: "Products_Details_Description.png", node: "460:43033", rect: CARD_IMAGE.card4x },
  { slug: "chanise-cabbage", png: "Products_Details_Description.png", node: "460:43031", rect: CARD_IMAGE.card4x },
  { slug: "red-capsicum", png: "Shopping_Cart.png", node: "460:42636", rect: CARD_IMAGE.cartRow },
  { slug: "fresh-indian-orange", png: "Shopping_Card_Popup.png", node: "629:6645", rect: CARD_IMAGE.full },
  // Shop grid ("Product 4x" instances use absolute frame coordinates).
  { slug: "green-cucumber", png: SHOP, node: "527:54370", abs: { x: 1308, y: 1278, w: 312, h: 407 }, rect: CARD_IMAGE.card4x, erase: [SALE_BADGE_4X] },
  { slug: "fresh-mango", png: SHOP, node: "527:54372", abs: { x: 1308, y: 2140, w: 312, h: 407 }, rect: CARD_IMAGE.card4x },
];

// Original banners with their artwork text (kept for reference / older consumers).
const bannerArt: Spec[] = [
  ["hero-main", "629:3495"],
  ["hero-sale", "629:3496"],
  ["hero-deal", "629:3497"],
  ["promo-sale-of-month", "629:3593"],
  ["promo-low-fat-meat", "629:3594"],
  ["promo-fresh-fruit", "629:3595"],
  ["discount-37", "629:3449"],
].map(([slug, node]) => ({ slug: slug!, png: HOME, node: node!, rect: CARD_IMAGE.full }));

// Text-free banner backgrounds ("<slug>-bg"): the page renders the copy live from
// lib/config/home.ts. Boxes measured on a 1x grid of each banner.
const { white, orange, green, dark, gray, silver, mint } = INK;
const bannerBgs: Spec[] = (
  [
    {
      slug: "hero-main-bg",
      node: "629:3495",
      clean: [
        { box: [44, 146, 410, 138], ink: [white], dilate: 16 },
        { box: [48, 288, 254, 88], ink: [white, orange, mint], dilate: 12 },
        { box: [48, 382, 214, 74], ink: [white, green], dilate: 10 },
      ],
    },
    {
      slug: "hero-sale-bg",
      node: "629:3496",
      clean: [{ box: [26, 26, 170, 148], ink: [dark, gray, green], tol: 90 }],
    },
    {
      slug: "hero-deal-bg",
      node: "629:3497",
      clean: [
        { box: [56, 56, 312, 118], ink: [white], tol: 70, dilate: 10, fill: "texture" },
        { box: [150, 194, 124, 30], ink: [green], tol: 70, fill: "texture" },
      ],
    },
    {
      slug: "promo-sale-of-month-bg",
      node: "629:3593",
      clean: [
        { box: [30, 28, 364, 152], ink: [white], tol: 80 },
        { box: [126, 192, 172, 54], ink: [white, green] },
      ],
    },
    {
      slug: "promo-low-fat-meat-bg",
      node: "629:3594",
      clean: [
        { box: [66, 28, 292, 126], ink: [white, orange], tol: 80 },
        { box: [126, 180, 172, 54], ink: [white, green] },
      ],
    },
    {
      slug: "promo-fresh-fruit-bg",
      node: "629:3595",
      clean: [
        { box: [46, 28, 332, 82], ink: [dark], tol: 90 },
        { box: [126, 116, 170, 50], ink: [dark], tol: 90 },
        { box: [126, 180, 172, 54], ink: [white, green] },
      ],
    },
    {
      slug: "discount-bg",
      node: "629:3449",
      clean: [
        { box: [816, 50, 244, 100], ink: [white, orange, silver], tol: 70, dilate: 12, fill: "texture" },
        { box: [816, 162, 418, 64], ink: [white, silver], tol: 70, dilate: 10, fill: "texture" },
        { box: [816, 236, 216, 70], ink: [white, green], tol: 70, dilate: 12, fill: "texture" },
      ],
    },
  ] satisfies { slug: string; node: string; clean: Clean[] }[]
).map((b) => ({ ...b, png: HOME, rect: CARD_IMAGE.full }));

// Shop: breadcrumb band photo (shared by every inner storefront page) and the
// sidebar discount banner, both text-free. Absolute boxes: the sidebar sits in
// nested frames the relative/absolute heuristic would misplace.
const shopBgs: Spec[] = [
  {
    slug: "breadcrumb-bg",
    png: SHOP,
    node: "531:1441",
    abs: { x: 0, y: 195, w: 1920, h: 120 },
    rect: CARD_IMAGE.full,
    clean: [{ box: [292, 44, 290, 34], ink: [white, gray, silver, green], tol: 90, dilate: 8, fill: "texture" }],
  },
  {
    slug: "shop-discount-bg",
    png: SHOP,
    node: "527:54511",
    abs: { x: 300, y: 1490, w: 312, h: 295 },
    rect: CARD_IMAGE.full,
    clean: [
      { box: [60, 20, 200, 44], ink: [orange, dark], tol: 90 },
      { box: [70, 62, 180, 26], ink: [dark, gray], tol: 90 },
      { box: [96, 88, 124, 32], ink: [green], tol: 100, dilate: 10 }, // not silver: it matches the banner gray
    ],
  },
];

const banners: Spec[] = [...bannerArt, ...bannerBgs, ...shopBgs];

// Home → Latest News: image area of each "Blog Card" (424×324), date chip removed.
const blog: Spec[] = [
  ["blog-1", "629:3439", 300],
  ["blog-2", "629:3440", 748],
  ["blog-3", "629:3441", 1196],
].map(([slug, node, x]) => ({
  slug: slug as string,
  png: HOME,
  node: node as string,
  abs: { x: x as number, y: 5090, w: 424, h: 324 },
  rect: CARD_IMAGE.full,
  clean: [{ box: [21, 239, 64, 64] }], // date chip
}));

// Home → Client Testimonials: avatar circles (56×56, 24px into each card, 174px down).
const avatars: Spec[] = [
  ["robert-fox", "629:3434", 300],
  ["dianne-russell", "629:3435", 748],
  ["eleanor-pena", "629:3436", 1196],
].map(([slug, node, x]) => ({
  slug: slug as string,
  png: HOME,
  node: node as string,
  abs: { x: (x as number) + 24, y: 5766 + 174, w: 56, h: 56 },
  rect: CARD_IMAGE.full,
}));

// Home → partner logo strip (each logo is its own node, 32 high).
const logos: Spec[] = [
  ["steps", "629:3284"],
  ["mango", "629:3286"],
  ["food-network", "629:3407"],
  ["food", "629:3413"],
  ["bookoff", "629:3421"],
  ["g-series", "629:3424"],
].map(([slug, node]) => ({ slug: slug!, png: HOME, node: node!, rect: CARD_IMAGE.full }));

// Home → Follow us on Instagram: 6 tiles of 200, 24 apart. Tile 2 is drawn in its
// hover state, so its Instagram glyph is removed (the page adds the hover overlay).
const instagram: Spec[] = Array.from({ length: 6 }, (_, i) => ({
  slug: `instagram-${i + 1}`,
  png: HOME,
  node: "629:3282",
  abs: { x: 300 + i * 224, y: 6392, w: 200, h: 200 },
  rect: CARD_IMAGE.full,
  clean: i === 1 ? [{ box: [80, 80, 40, 40], ink: [INK.white], tol: 90 }] : undefined,
}));

// PDP / Quick View "Brand:" tile (56×56, bordered; the page draws the border, so crop inside it).
const brands: Spec[] = [
  { slug: "farmary", png: "Product_Detail_Customer_Feedback.png", node: "629:2917", rect: [0.04, 0.04, 0.96, 0.96] },
];

// Footer bottom bar: payment badges (bordered, on the footer color).
const payments: Spec[] = [
  ["apple-pay", 1343, 45],
  ["visa", 1396, 45],
  ["discover", 1449, 45],
  ["mastercard", 1502, 45],
  ["secure-payment", 1555, 65],
].map(([slug, x, w]) => ({
  slug: slug as string,
  png: HOME,
  node: "629:3281",
  abs: { x: x as number, y: 7111, w: w as number, h: 32 },
  rect: CARD_IMAGE.full,
}));

// Home → feature strip icons (40×40 frames).
const icons: Spec[] = [
  ["delivery-truck", "629:3500"],
  ["headphones", "629:3527"],
  ["shopping-bag", "629:3558"],
  ["package", "629:3586"],
].map(([slug, node]) => ({ slug: slug!, png: HOME, node: node!, rect: CARD_IMAGE.full }));

// PDP tabs (Products_Details_*.png, Product_Detail_Customer_Feedback.png). The
// metadata nests these under "Product Detail" (y 347) with mixed frames, so the
// boxes are given absolutely (1x px on the 1920 screen).
const AI = "Products_Details_Additional Info.png";
const FB = "Product_Detail_Customer_Feedback.png";

// Descriptions / Additional Info video poster (536×300). The page draws the play button.
const pdpBanners: Spec[] = [
  {
    slug: "pdp-video",
    png: AI,
    node: "531:13216",
    abs: { x: 1084, y: 993, w: 536, h: 300 },
    rect: CARD_IMAGE.full,
    clean: [{ box: [240, 122, 56, 56] }],
  },
];

// "64% Discount" / "100% Organic" highlight icons (32×32).
const pdpIcons: Spec[] = [
  { slug: "pdp-discount", png: AI, node: "531:13224", abs: { x: 1103, y: 1346, w: 32, h: 33 }, rect: CARD_IMAGE.full },
  { slug: "pdp-organic", png: AI, node: "531:13234", abs: { x: 1371, y: 1346, w: 32, h: 33 }, rect: CARD_IMAGE.full },
];

// Customer Feedback reviewer avatars (41×41; Jane Cooper has the placeholder icon, drawn live).
const pdpAvatars: Spec[] = [
  ["kristin-watson", "531:14273", 1003],
  ["jacob-jones", "531:14326", 1273],
  ["ralph-edwards", "531:14350", 1387],
].map(([slug, node, y]) => ({
  slug: slug as string,
  png: FB,
  node: node as string,
  abs: { x: 300, y: y as number, w: 41, h: 41 },
  rect: CARD_IMAGE.full,
}));

// ───────────────────────── processing ─────────────────────────

const pngCache = new Map<string, Buffer>();
function screen(png: string) {
  let buf = pngCache.get(png);
  if (!buf) {
    buf = readFileSync(resolve(designs, "screens/web", png));
    pngCache.set(png, buf);
  }
  return buf;
}

function px(box: Box, r: Rect) {
  const left = Math.round((box.x + box.w * r[0]) * SCALE);
  const top = Math.round((box.y + box.h * r[1]) * SCALE);
  const width = Math.round(box.w * (r[2] - r[0]) * SCALE);
  const height = Math.round(box.h * (r[3] - r[1]) * SCALE);
  return { left, top, width, height };
}

async function cut(spec: Spec, box: Box, mode: "photo" | "banner") {
  // 1. the whole node, with badge areas painted white
  const node = px(box, [0, 0, 1, 1]);
  let img = await sharp(screen(spec.png)).extract(node).png().toBuffer();
  if (spec.erase?.length) {
    const local: Box = { x: 0, y: 0, w: box.w, h: box.h };
    img = await sharp(img)
      .composite(
        spec.erase.map((r) => {
          const e = px(local, r);
          return {
            input: { create: { width: e.width, height: e.height, channels: 4 as const, background: WHITE } },
            left: e.left,
            top: e.top,
          };
        }),
      )
      .png()
      .toBuffer();
  }

  if (spec.clean?.length) img = await inpaint(img, spec.clean);

  // 2. the image area inside the node
  img = await sharp(img).extract(px({ x: 0, y: 0, w: box.w, h: box.h }, spec.rect)).png().toBuffer();
  if (mode === "banner") return img;

  // 3. trim the white background, pad to a centered square with a margin
  img = await sharp(img).trim({ background: WHITE, threshold: 18 }).png().toBuffer();
  const { width = 0, height = 0 } = await sharp(img).metadata();
  const side = Math.round(Math.max(width, height) * 1.16);
  const padX = side - width;
  const padY = side - height;
  // Separate passes: within one pipeline sharp applies resize before extend.
  const squared = await sharp(img)
    .extend({
      left: Math.floor(padX / 2),
      right: Math.ceil(padX / 2),
      top: Math.floor(padY / 2),
      bottom: Math.ceil(padY / 2),
      background: WHITE,
    })
    .png()
    .toBuffer();
  return sharp(squared)
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .flatten({ background: WHITE })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Remove baked-in text: mask it (see `Clean`), then rebuild masked pixels from their surroundings. */
async function inpaint(png: Buffer, cleans: Clean[]) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = info;
  const PROBE = 4; // clean pixels averaged past the mask edge (dampens noise)

  // 1. mask
  const mask = new Uint8Array(W * H);
  for (const { box, ink, tol = 80, dilate = 6, fill = "smooth" } of cleans) {
    const x0 = Math.max(0, Math.round(box[0] * SCALE));
    const y0 = Math.max(0, Math.round(box[1] * SCALE));
    const x1 = Math.min(W, Math.round((box[0] + box[2]) * SCALE));
    const y1 = Math.min(H, Math.round((box[1] + box[3]) * SCALE));
    const core = new Uint8Array(W * H);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const o = (y * W + x) * C;
        const hit =
          !ink ||
          ink.some(
            ([r, g, b]) => Math.hypot(data[o]! - r, data[o + 1]! - g, data[o + 2]! - b) <= tol,
          );
        if (hit) core[y * W + x] = 1;
      }
    }
    const r = ink ? dilate : 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (!core[y * W + x]) continue;
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const X = x + dx;
            const Y = y + dy;
            if (X >= 0 && Y >= 0 && X < W && Y < H) mask[Y * W + X] = fill === "texture" ? 2 : 1;
          }
        }
      }
    }
  }

  // 2a. texture: per column, mirror the clean pixels above (top half) / below (bottom half) of each run
  const isMasked = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || mask[y * W + x] !== 0;
  for (let x = 0; x < W; x++) {
    let y = 0;
    while (y < H) {
      if (mask[y * W + x] !== 2) {
        y++;
        continue;
      }
      const top = y;
      while (y < H && mask[y * W + x] === 2) y++;
      const bottom = y; // exclusive
      const L = bottom - top;
      for (let t = 0; t < L; t++) {
        const fromTop = t < L / 2;
        let sy = fromTop ? top - 1 - t : bottom + (L - 1 - t);
        if (isMasked(x, sy)) sy = fromTop ? bottom + (L - 1 - t) : top - 1 - t;
        if (isMasked(x, sy)) continue; // left to the smooth pass below
        for (let c = 0; c < C; c++) data[((top + t) * W + x) * C + c] = data[(sy * W + x) * C + c]!;
        mask[(top + t) * W + x] = 3; // done
      }
    }
  }
  for (let i = 0; i < mask.length; i++) if (mask[i] === 3) mask[i] = 0;

  // 2. inverse-distance blend of the nearest clean pixel left/right/up/down
  const px = (x: number, y: number, c: number) => data[(y * W + x) * C + c]!;
  const masked: number[] = [];
  const next = new Float32Array(data.length);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      masked.push(y * W + x);
      const probes: [number, number, number, number, number][] = []; // [x, y, distance, dx, dy]
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        let X = x + dx;
        let Y = y + dy;
        while (X >= 0 && Y >= 0 && X < W && Y < H && mask[Y * W + X]) {
          X += dx;
          Y += dy;
        }
        if (X >= 0 && Y >= 0 && X < W && Y < H) probes.push([X, Y, Math.abs(X - x) + Math.abs(Y - y), dx, dy]);
      }
      for (let c = 0; c < C; c++) {
        let num = 0;
        let den = 0;
        for (const [X, Y, d, dx, dy] of probes) {
          let sum = 0;
          let n = 0;
          for (let k = 0; k < PROBE; k++) {
            const PX = X + dx * k;
            const PY = Y + dy * k;
            if (PX < 0 || PY < 0 || PX >= W || PY >= H || mask[PY * W + PX]) break;
            sum += px(PX, PY, c);
            n++;
          }
          num += sum / n / d;
          den += 1 / d;
        }
        next[(y * W + x) * C + c] = den ? num / den : px(x, y, c);
      }
    }
  }
  for (const i of masked) for (let c = 0; c < C; c++) data[i * C + c] = next[i * C + c]!;

  // 3. relax the cross-shaped artifacts (Jacobi iterations over masked pixels only)
  for (let it = 0; it < 40; it++) {
    for (const i of masked) {
      const x = i % W;
      const y = (i - x) / W;
      for (let c = 0; c < C; c++) {
        next[i * C + c] =
          (px(Math.max(0, x - 1), y, c) +
            px(Math.min(W - 1, x + 1), y, c) +
            px(x, Math.max(0, y - 1), c) +
            px(x, Math.min(H - 1, y + 1), c)) /
          4;
      }
    }
    for (const i of masked) for (let c = 0; c < C; c++) data[i * C + c] = next[i * C + c]!;
  }

  return sharp(data, { raw: { width: W, height: H, channels: C } }).png().toBuffer();
}

/** A storefront color token from designs/tokens.json as RGB. */
function tokenRgb(name: string): RGB {
  const tokens = JSON.parse(readFileSync(resolve(designs, "tokens.json"), "utf8")) as {
    storefront: { color: Record<string, { value: string }> };
  };
  const hex = tokens.storefront.color[name]?.value;
  if (!hex) throw new Error(`No storefront color token "${name}" in designs/tokens.json`);
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Logo on white → one flat color on transparent. Alpha comes from darkness
 * (255 − luminance), normalized per logo so a green and a gray source logo end up
 * equally opaque.
 */
async function tintLogo(png: Buffer, [r, g, b]: RGB) {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const lum = (i: number) => 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
  let min = 255;
  for (let i = 0; i < data.length; i += info.channels) min = Math.min(min, lum(i));
  const range = Math.max(1, 255 - min);
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0, i = 0; p < out.length; p += 4, i += info.channels) {
    out[p] = r;
    out[p + 1] = g;
    out[p + 2] = b;
    out[p + 3] = Math.round(Math.min(1, Math.max(0, (255 - lum(i)) / range)) * 255);
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

type ManifestEntry = {
  url: string;
  width: number;
  height: number;
  source: { png: string; nodeId: string };
};
export type AssetManifest = Record<AssetGroup, Record<string, ManifestEntry>>;

async function main() {
  const boxes = loadBoxes();

  // Chinese Cabbage main image: "Product Details Images" frame on the Additional Info PDP
  // (the Description PDP has the category menu open over it).
  const pdpMainId = findIdByName("Product Details Images", "531:12558");
  const pdpMainBox = pdpMainId && boxes.get(pdpMainId);
  if (!pdpMainId || !pdpMainBox) throw new Error("PDP main image node not found in metadata.xml");
  boxes.set("PDP_MAIN", pdpMainBox);

  const manifest = Object.fromEntries(ASSET_GROUPS.map((g) => [g, {}])) as AssetManifest;
  const groups = [
    ["products", products, "photo"],
    ["categories", categories, "photo"],
    ["banners", [...banners, ...pdpBanners], "banner"],
    ["blog", blog, "banner"],
    ["avatars", [...avatars, ...pdpAvatars], "banner"],
    ["logos", logos, "banner"],
    ["brands", brands, "banner"],
    ["instagram", instagram, "banner"],
    ["payments", payments, "banner"],
    ["icons", [...icons, ...pdpIcons], "banner"],
  ] as const satisfies readonly (readonly [AssetGroup, Spec[], "photo" | "banner"])[];

  for (const [dir, specs, mode] of groups) {
    mkdirSync(resolve(designs, "assets", dir), { recursive: true });
    for (const spec of specs) {
      const box = spec.abs ?? boxes.get(spec.node);
      if (!box) throw new Error(`Node ${spec.node} (${spec.slug}) not found in metadata.xml`);
      const out = await cut(spec, box, mode);
      // Partner logos: transparent, single-ink variants — resting gray + "-hover" brand green.
      const variants: [string, Buffer][] =
        dir === "logos"
          ? [
              [spec.slug, await tintLogo(out, tokenRgb("muted-foreground"))],
              [`${spec.slug}-hover`, await tintLogo(out, tokenRgb("primary"))],
            ]
          : [[spec.slug, out]];
      for (const [slug, buf] of variants) {
        writeFileSync(resolve(designs, "assets", dir, `${slug}.png`), buf);
        const { width = 0, height = 0 } = await sharp(buf).metadata();
        manifest[dir][slug] = {
          url: `/seed/${dir}/${slug}.png`,
          width,
          height,
          source: { png: `designs/screens/web/${spec.png}`, nodeId: spec.node === "PDP_MAIN" ? pdpMainId : spec.node },
        };
      }
    }
  }

  writeFileSync(resolve(designs, "assets/manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  syncAssets();
  console.log(
    `✔ ${groups.map(([dir, specs]) => `${specs.length} ${dir}`).join(", ")} → designs/assets (+ public/seed)`,
  );
}

/** First node with this layer name after the given top-level frame starts in metadata.xml. */
function findIdByName(name: string, frameId: string): string | undefined {
  const xml = readFileSync(resolve(designs, "raw/metadata.xml"), "utf8");
  const start = xml.indexOf(`id="${frameId}"`);
  return new RegExp(`id="([^"]+)" name="${name}"`).exec(xml.slice(start))?.[1];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
