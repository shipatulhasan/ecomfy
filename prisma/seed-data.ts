/**
 * Seed catalog, taken from the design screenshots (designs/screens/web/*.png).
 * Images are cropped from those screenshots by `pnpm assets:crop`.
 * Prices are in dollars here and converted to cents by the seed.
 */

export type SeedVariant = {
  name: string; // "500 g", "1 kg"
  weightGrams?: number;
  price: number;
  compareAt?: number;
  stock: number;
  isDefault?: boolean;
};

export type SeedProduct = {
  name: string;
  category: string; // category slug
  /** Crop slug in designs/assets/manifest.json (defaults to the product slug). */
  image?: string;
  /** Extra gallery crops after the main image (PDP / Quick View thumbnails). */
  gallery?: string[];
  /** Star ratings of the seeded reviews (one per reviewer) → ratingAvg / reviewCount. */
  ratings?: number[];
  description?: string;
  shortDescription?: string;
  brand?: string;
  productType?: string;
  tags?: string[];
  color?: string;
  isFeatured?: boolean;
  dealDays?: number; // Hot Deals countdown → dealEndsAt = now + days
  sku?: string;
  /** PDP Additional Information rows; derived from weight/color/type when omitted. */
  attributes?: { name: string; value: string }[];
  /** PDP Descriptions video (the poster is the banners/pdp-video crop). */
  videoUrl?: string;
  variants: SeedVariant[];
};

// Home → "Popular Categories" (12 tiles, in screen order).
export const categories = [
  { name: "Fresh Fruit", slug: "fresh-fruit" },
  { name: "Fresh Vegetables", slug: "fresh-vegetables" },
  { name: "Meat & Fish", slug: "meat-fish" },
  { name: "Snacks", slug: "snacks" },
  { name: "Beverages", slug: "beverages" },
  { name: "Beauty & Health", slug: "beauty-health" },
  { name: "Bread & Bakery", slug: "bread-bakery" },
  { name: "Baking Needs", slug: "baking-needs" },
  { name: "Cooking", slug: "cooking" },
  { name: "Diabetic Food", slug: "diabetic-food" },
  { name: "Dish Detergents", slug: "dish-detergents" },
  { name: "Oil", slug: "oil" },
] as const;

// Product.description is HTML (sanitized on read, lib/rich-text.ts).
const LOREM_DESC =
  "<p>Sed commodo aliquam dui ac porta. Fusce ipsum felis, imperdiet at posuere ac, viverra at mauris. Maecenas tincidunt ligula a sem vestibulum pharetra. Maecenas auctor tortor lacus, nec laoreet nisi porttitor vel. Etiam tincidunt metus vel dui interdum sollicitudin.</p><p>Nulla mauris tellus, feugiat quis pharetra sed, gravida ac dui. Sed iaculis, metus faucibus elementum tincidunt, turpis mi viverra velit, pellentesque tristique neque mi eget nulla.</p>";

// PDP → Descriptions (Products_Details_Description.png), verbatim.
const CHINESE_CABBAGE_DESC = [
  "<p>Sed commodo aliquam dui ac porta. Fusce ipsum felis, imperdiet at posuere ac, viverra at mauris. Maecenas tincidunt ligula a sem vestibulum pharetra. Maecenas auctor tortor lacus, nec laoreet nisi porttitor vel. Etiam tincidunt metus vel dui interdum sollicitudin. Mauris sem ante, vestibulum nec orci vitae, aliquam mollis lacus. Sed et condimentum arcu, id molestie tellus. Nulla facilisi. Nam scelerisque vitae justo a convallis. Morbi urna ipsum, placerat quis commodo quis, egestas elementum leo. Donec convallis mollis enim. Aliquam id mi quam. Phasellus nec fringilla elit.</p>",
  "<p>Nulla mauris tellus, feugiat quis pharetra sed, gravida ac dui. Sed iaculis, metus faucibus elementum tincidunt, turpis mi viverra velit, pellentesque tristique neque mi eget nulla. Proin luctus elementum neque et pharetra.</p>",
  "<ul><li>100 g of fresh leaves provides.</li><li>Aliquam ac est at augue volutpat elementum.</li><li>Quisque nec enim eget sapien molestie.</li><li>Proin convallis odio volutpat finibus posuere.</li></ul>",
  "<p>Cras et diam maximus, accumsan sapien et, sollicitudin velit. Nulla blandit eros non turpis lobortis iaculis at ut massa.</p>",
].join("");

/** Public CC0 sample clip (MDN) standing in for a product video. */
const SAMPLE_VIDEO = "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

const LOREM_SHORT =
  "Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nulla nibh diam, blandit vel consequat nec, ultrices et ipsum.";

/** 1 kg default + 500 g option, priced from the 1 kg price. */
function produce(price: number, stock: number, compareAt?: number): SeedVariant[] {
  return [
    { name: "1 kg", weightGrams: 1000, price, compareAt, stock, isDefault: true },
    {
      name: "500 g",
      weightGrams: 500,
      price: Math.round(price * 55) / 100,
      compareAt: compareAt ? Math.round(compareAt * 55) / 100 : undefined,
      stock: Math.round(stock / 2),
    },
  ];
}

export const products: SeedProduct[] = [
  // ── Fresh Vegetables ──
  {
    // PDP screens: $17.28 (was $48.00), 64% off, SKU 2,51,594, 4 reviews, brand Farmary.
    name: "Chinese Cabbage",
    category: "fresh-vegetables",
    brand: "Farmary",
    productType: "Organic",
    color: "Green",
    sku: "2,51,594",
    tags: ["Vegetables", "Healthy", "Chinese", "Cabbage", "Green Cabbage"],
    description: CHINESE_CABBAGE_DESC,
    // Additional Information rows, as in the PNG ("Weight: 03").
    attributes: [
      { name: "Weight", value: "03" },
      { name: "Color", value: "Green" },
      { name: "Type", value: "Organic" },
    ],
    videoUrl: SAMPLE_VIDEO,
    gallery: ["chinese-cabbage-2", "chinese-cabbage-3", "chinese-cabbage-4"],
    // Quick View / PDP summary, verbatim.
    shortDescription:
      "Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Nulla nibh diam, blandit vel consequat nec, ultrices et ipsum. Nulla varius magna a consequat pulvinar.",
    isFeatured: true,
    variants: [{ name: "1 kg", weightGrams: 1000, price: 17.28, compareAt: 48.0, stock: 5413, isDefault: true }],
  },
  { name: "Green Lettuce", category: "fresh-vegetables", variants: produce(9.0, 320), isFeatured: true },
  { name: "Eggplant", category: "fresh-vegetables", variants: produce(34.0, 140), isFeatured: true },
  { name: "Big Potatoes", category: "fresh-vegetables", variants: produce(20.0, 800) },
  { name: "Corn", category: "fresh-vegetables", variants: produce(20.0, 410), dealDays: 2 },
  { name: "Fresh Cauliflower", category: "fresh-vegetables", variants: produce(12.0, 260) },
  {
    // Cards: $9.00 (was $20.99); Cart/Checkout/Order Details: $14.00 → two variants.
    name: "Green Capsicum",
    category: "fresh-vegetables",
    color: "Green",
    dealDays: 1,
    variants: [
      { name: "500 g", weightGrams: 500, price: 9.0, compareAt: 20.99, stock: 180, isDefault: true },
      { name: "1 kg", weightGrams: 1000, price: 14.0, stock: 120 },
    ],
  },
  { name: "Red Capsicum", category: "fresh-vegetables", color: "Red", variants: produce(14.0, 150) },
  { name: "Green Chili", category: "fresh-vegetables", variants: produce(34.0, 90), dealDays: 3 },
  { name: "Red Chili", category: "fresh-vegetables", variants: produce(12.0, 75) },
  { name: "Red Tomatoes", category: "fresh-vegetables", variants: produce(9.0, 500, 20.99), dealDays: 1 },
  { name: "Ladies Finger", category: "fresh-vegetables", variants: produce(14.99, 210) },
  { name: "Chanise Cabbage", category: "fresh-vegetables", variants: produce(14.99, 95) }, // spelled as in Related Products

  // ── Fresh Fruit ──
  { name: "Green Apple", category: "fresh-fruit", variants: produce(14.99, 600, 20.99), isFeatured: true, dealDays: 2 },
  { name: "Fresh Indian Malta", category: "fresh-fruit", variants: produce(20.0, 340), isFeatured: true },
  { name: "Fresh Indian Orange", category: "fresh-fruit", variants: produce(12.0, 380) }, // cart drawer "1 kg × 12.00"
  {
    // Wishlist: "Fresh Sujapuri Mango $9.00 — Out of Stock".
    name: "Surjapuri Mango",
    category: "fresh-fruit",
    variants: [{ name: "1 kg", weightGrams: 1000, price: 9.0, stock: 0, isDefault: true }],
  },

  // ── Shop grid (Shop.png) ──
  { name: "Green Cucumber", category: "fresh-vegetables", variants: produce(14.99, 230, 20.99) },
  { name: "Fresh Mango", category: "fresh-fruit", variants: produce(14.99, 310) },

  // ── Padding so Shop has ~52 products (Shop.png: "52 Results Found", 15 per page). ──
  // The design only contains produce photos, so these reuse real crops (`image`).
  ...padded(),
];

/**
 * Extra fruit & veg for the Shop listing. Prices, stock, brands and ratings vary
 * deterministically so every filter and sort has something to show.
 */
function padded(): SeedProduct[] {
  const rows: [name: string, category: "fresh-fruit" | "fresh-vegetables", image: string][] = [
    ["Organic Green Apple", "fresh-fruit", "green-apple"],
    ["Granny Smith Apple", "fresh-fruit", "green-apple"],
    ["Baby Malta", "fresh-fruit", "fresh-indian-malta"],
    ["Sweet Lime", "fresh-fruit", "fresh-indian-malta"],
    ["Nagpur Orange", "fresh-fruit", "fresh-indian-orange"],
    ["Valencia Orange", "fresh-fruit", "fresh-indian-orange"],
    ["Mandarin Orange", "fresh-fruit", "fresh-indian-orange"],
    ["Alphonso Mango", "fresh-fruit", "fresh-mango"],
    ["Langra Mango", "fresh-fruit", "fresh-mango"],
    ["Himsagar Mango", "fresh-fruit", "surjapuri-mango"],
    ["Baby Potatoes", "fresh-vegetables", "big-potatoes"],
    ["Red Potatoes", "fresh-vegetables", "big-potatoes"],
    ["Sweet Corn", "fresh-vegetables", "corn"],
    ["Baby Corn", "fresh-vegetables", "corn"],
    ["Organic Cauliflower", "fresh-vegetables", "fresh-cauliflower"],
    ["Romaine Lettuce", "fresh-vegetables", "green-lettuce"],
    ["Iceberg Lettuce", "fresh-vegetables", "green-lettuce"],
    ["Bok Choy", "fresh-vegetables", "chanise-cabbage"],
    ["Napa Cabbage", "fresh-vegetables", "chinese-cabbage"],
    ["Baby Eggplant", "fresh-vegetables", "eggplant"],
    ["Purple Brinjal", "fresh-vegetables", "eggplant"],
    ["Green Bell Pepper", "fresh-vegetables", "green-capsicum"],
    ["Red Bell Pepper", "fresh-vegetables", "red-capsicum"],
    ["Thai Green Chili", "fresh-vegetables", "green-chili"],
    ["Kashmiri Red Chili", "fresh-vegetables", "red-chili"],
    ["Bird's Eye Chili", "fresh-vegetables", "red-chili"],
    ["Cherry Tomatoes", "fresh-vegetables", "red-tomatoes"],
    ["Roma Tomatoes", "fresh-vegetables", "red-tomatoes"],
    ["English Cucumber", "fresh-vegetables", "green-cucumber"],
    ["Mini Cucumber", "fresh-vegetables", "green-cucumber"],
    ["Organic Okra", "fresh-vegetables", "ladies-finger"],
    ["Tender Okra", "fresh-vegetables", "ladies-finger"],
    ["Farm Fresh Cabbage", "fresh-vegetables", "chanise-cabbage"],
  ];
  return rows.map(([name, category, image], i) => {
    const price = 5 + ((i * 37) % 56) + (i % 2 ? 0.99 : 0.49); // $5.49 … $60.99
    const onSale = i % 4 === 1;
    const stock = i % 11 === 5 ? 0 : 40 + ((i * 53) % 400); // a few out of stock
    return { name, category, image, variants: produce(price, stock, onSale ? Math.round(price * 140) / 100 : undefined) };
  });
}

// Shop → "Popular Tag" (Shop.png order; typos "Launch"/"Breackfast" fixed). Each
// tag gets a descending share of the catalog so the most-used-first list keeps this order.
const POPULAR_TAGS = [
  "Healthy", "Low fat", "Vegetarian", "Kid foods", "Vitamins", "Bread", "Meat",
  "Snacks", "Tiffin", "Lunch", "Dinner", "Breakfast", "Fruit",
] as const;

const BRANDS = ["Farmary", "Green Valley", "Organic Roots", "FreshCo", "Nature's Basket"] as const;

// Average ratings cycle through these so the Rating filter has every band.
// One 7-review set gives a few products a second "Load More" page (4 per page).
const RATING_SETS = [[5, 5, 4], [4, 4, 5], [4, 3, 4], [5, 4], [3, 3, 4], [4, 5, 5, 4], [2, 3, 3], [4, 4], [1, 2, 2], [5, 5, 5], [3, 4, 3], [5, 4, 5, 4, 4, 5, 3]];

/** Bodies for the generated reviews (cycled). */
export const REVIEW_BODIES = [
  "Fresh and exactly as described.",
  "Arrived well packed and lasted the whole week in the fridge.",
  "Good quality for the price. Will order again.",
  "Tasty, though a couple of pieces were smaller than I expected.",
  "Delivery was quick and everything was crisp.",
  "My family loved it. Great for weeknight cooking.",
  "Decent, but I've had fresher from the market.",
];

for (const [i, p] of products.entries()) {
  p.description ??= LOREM_DESC;
  p.shortDescription ??= LOREM_SHORT;
  p.productType ??= "Organic";
  p.brand ??= i % 6 === 5 ? undefined : BRANDS[i % BRANDS.length];
  p.tags ??= POPULAR_TAGS.filter((_, t) => (i * 7 + t * 5) % products.length < products.length * (0.6 - t * 0.04));
  // Chinese Cabbage keeps its PDP "Customer Feedback" reviews (chineseCabbageReviews).
  if (p.name !== "Chinese Cabbage") p.ratings ??= RATING_SETS[i % RATING_SETS.length];
}

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// PDP → Customer Feedback (Chinese Cabbage, "4 Review"). Newest first puts Kristin
// on top as in the PNG; Jane Cooper's dated review sorts last (the PNG shows it second).
export const chineseCabbageReviews = [
  { reviewer: "Kristin Watson", rating: 5, body: "Duis at ullamcorper nulla, eu dictum eros.", minutesAgo: 2 },
  {
    reviewer: "Jane Cooper",
    rating: 4,
    body: "Keep the soil evenly moist for the healthiest growth. If the sun gets too hot, Chinese cabbage tends to \"bolt\" or go to seed; in long periods of heat, some kind of shade may be helpful. Watch out for snails, as they will harm the plants.",
    minutesAgo: 60 * 24 * 300,
  },
  { reviewer: "Jacob Jones", rating: 5, body: "Vivamus eget euismod magna. Nam sed lacinia nibh, et lacinia lacus.", minutesAgo: 3 },
  {
    reviewer: "Ralph Edwards",
    rating: 5,
    body: "200+ Canton Pak Choi Bok Choy Chinese Cabbage Seeds Heirloom Non-GMO Productive Brassica rapa VAR chinensis, a.k.a. Canton's Choice, Bok Choi, from USA",
    minutesAgo: 4,
  },
];
