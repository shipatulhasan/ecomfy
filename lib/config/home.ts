/**
 * Home page marketing content (designs/screens/web/Home.png). Products and
 * categories come from the DB (lib/queries); everything here is static copy.
 *
 * Banner images are the text-free crops ("*-bg", scripts/crop-assets.ts) — the
 * copy below is rendered live on top of them.
 *
 * News and testimonials live here until Blog / Testimonial models exist.
 */
import { asset, type Asset } from "@/lib/assets";

export type Cta = { label: string; href: string };

export type HeroMain = {
  title: string;
  saleLead: string;
  saleHighlight: string;
  subtitle: string;
  cta: Cta;
  image: Asset;
};

export type HeroSide = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  cta: Cta;
  image: Asset;
  tone: "light" | "dark";
};

export type Promo = {
  eyebrow: string;
  title: string;
  image: Asset;
  tone: "blue" | "dark" | "yellow";
  cta: Cta;
  /** Live countdown to the end of the current month (viewer's clock). */
  countdown?: "end-of-month";
  /** "Started at $79.99" */
  price?: { lead: string; value: string };
  /** "Up to [64% OFF]" */
  highlight?: { lead: string; value: string };
};

export type Partner = { name: string; image: Asset; hoverImage: Asset };
export type Feature = { title: string; description: string; icon: Asset };
export type Section = { title: string; viewAll?: Cta };

export type NewsPost = {
  date: string; // ISO date; shown as "18 NOV"
  tag: string;
  author: string;
  comments: number;
  title: string;
  href: string;
  image: Asset;
};

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  rating: number;
  avatar: Asset;
};

export type HomeContent = {
  hero: { main: HeroMain; side: readonly [HeroSide, HeroSide] };
  features: readonly Feature[];
  sections: Record<
    | "popularCategories"
    | "popularProducts"
    | "hotDeals"
    | "featuredProducts"
    | "latestNews"
    | "testimonials"
    | "instagram",
    Section
  >;
  promos: readonly [Promo, Promo, Promo];
  hotDeals: { spotlightBadge: string; countdownLabel: string };
  discount: {
    eyebrow: string;
    highlight: string;
    title: string;
    description: string;
    cta: Cta;
    image: Asset;
  };
  news: readonly NewsPost[];
  testimonials: readonly Testimonial[];
  /** Logos rest gray; `hoverImage` is the brand-green state shown on hover. */
  partners: readonly Partner[];
  instagram: { href: string; images: readonly Asset[] };
};

const shop: Cta = { label: "Shop now", href: "/shop" };
const lorem =
  "Pellentesque eu nibh eget mauris congue mattis mattis nec tellus. Phasellus imperdiet elit eu magna dictum, bibendum cursus velit sodales. Donec sed neque eget";

export const homeContent = {
  hero: {
    main: {
      title: "Fresh & Healthy Organic Food",
      saleLead: "Sale up to",
      saleHighlight: "30% OFF",
      subtitle: "Free shipping on all your order.",
      cta: shop,
      image: asset("banners", "hero-main-bg"),
    },
    side: [
      {
        eyebrow: "Summer Sale",
        title: "75% OFF",
        subtitle: "Only Fruit & Vegetable",
        cta: { label: "Shop Now", href: "/shop?category=fresh-fruit" },
        image: asset("banners", "hero-sale-bg"),
        tone: "light",
      },
      {
        eyebrow: "Best Deal",
        title: "Special Products Deal of the Month",
        cta: { label: "Shop Now", href: "/shop" },
        image: asset("banners", "hero-deal-bg"),
        tone: "dark",
      },
    ],
  },
  features: [
    {
      title: "Free Shipping",
      description: "Free shipping on all your order",
      icon: asset("icons", "delivery-truck"),
    },
    {
      title: "Customer Support 24/7",
      description: "Instant access to Support",
      icon: asset("icons", "headphones"),
    },
    {
      title: "100% Secure Payment",
      description: "We ensure your money is save",
      icon: asset("icons", "shopping-bag"),
    },
    {
      title: "Money-Back Guarantee",
      description: "30 Days Money-Back Guarantee",
      icon: asset("icons", "package"),
    },
  ],
  sections: {
    popularCategories: { title: "Popular Categories", viewAll: { label: "View All", href: "/shop" } },
    popularProducts: { title: "Popular Products", viewAll: { label: "View All", href: "/shop" } },
    hotDeals: { title: "Hot Deals", viewAll: { label: "View All", href: "/shop?sort=deals" } },
    featuredProducts: { title: "Featured Products", viewAll: { label: "View All", href: "/shop" } },
    latestNews: { title: "Latest News" },
    testimonials: { title: "Client Testimonials" },
    instagram: { title: "Follow us on Instagram" },
  },
  promos: [
    {
      eyebrow: "Best Deals",
      title: "Sale of the Month",
      image: asset("banners", "promo-sale-of-month-bg"),
      tone: "blue",
      countdown: "end-of-month",
      cta: { label: "Shop Now", href: "/shop?sort=deals" },
    },
    {
      eyebrow: "85% Fat Free",
      title: "Low-Fat Meat",
      image: asset("banners", "promo-low-fat-meat-bg"),
      tone: "dark",
      price: { lead: "Started at", value: "$79.99" },
      cta: { label: "Shop Now", href: "/shop?category=meat-fish" },
    },
    {
      eyebrow: "Summer Sale",
      title: "100% Fresh Fruit",
      image: asset("banners", "promo-fresh-fruit-bg"),
      tone: "yellow",
      highlight: { lead: "Up to", value: "64% OFF" },
      cta: { label: "Shop Now", href: "/shop?category=fresh-fruit" },
    },
  ],
  hotDeals: { spotlightBadge: "Best Sale", countdownLabel: "Hurry up! Offer ends In:" },
  discount: {
    eyebrow: "Summer Sale",
    highlight: "37%",
    title: "OFF",
    description: "Free on all your order, Free Shipping and 30 days money-back guarantee",
    cta: { label: "Shop Now", href: "/shop" },
    image: asset("banners", "discount-bg"),
  },
  news: [
    {
      date: "2026-11-18",
      tag: "Food",
      author: "Admin",
      comments: 65,
      title: "Curabitur porttitor orci eget neque accumsan venenatis. Nunc fermentum.",
      href: "/blog",
      image: asset("blog", "blog-1"),
    },
    {
      date: "2026-01-29",
      tag: "Food",
      author: "Admin",
      comments: 65,
      title: "Eget lobortis lorem lacinia. Vivamus pharetra semper,",
      href: "/blog",
      image: asset("blog", "blog-2"),
    },
    {
      date: "2026-02-21",
      tag: "Food",
      author: "Admin",
      comments: 65,
      title: "Maecenas blandit risus elementum mauris malesuada.",
      href: "/blog",
      image: asset("blog", "blog-3"),
    },
  ],
  testimonials: [
    { quote: lorem, name: "Robert Fox", role: "Customer", rating: 5, avatar: asset("avatars", "robert-fox") },
    { quote: lorem, name: "Dianne Russell", role: "Customer", rating: 5, avatar: asset("avatars", "dianne-russell") },
    { quote: lorem, name: "Eleanor Pena", role: "Customer", rating: 5, avatar: asset("avatars", "eleanor-pena") },
  ],
  partners: [
    { name: "Steps", image: asset("logos", "steps"), hoverImage: asset("logos", "steps-hover") },
    { name: "Mango", image: asset("logos", "mango"), hoverImage: asset("logos", "mango-hover") },
    { name: "Food Network", image: asset("logos", "food-network"), hoverImage: asset("logos", "food-network-hover") },
    { name: "Food.co.uk", image: asset("logos", "food"), hoverImage: asset("logos", "food-hover") },
    { name: "Book Off", image: asset("logos", "bookoff"), hoverImage: asset("logos", "bookoff-hover") },
    { name: "G Series", image: asset("logos", "g-series"), hoverImage: asset("logos", "g-series-hover") },
  ],
  instagram: {
    href: "https://instagram.com",
    images: [1, 2, 3, 4, 5, 6].map((n) =>
      asset("instagram", `instagram-${n}` as `instagram-${1 | 2 | 3 | 4 | 5 | 6}`),
    ),
  },
} as const satisfies HomeContent;
