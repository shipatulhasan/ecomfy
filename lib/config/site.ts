/**
 * Storefront chrome content (header, newsletter band, footer) — shared by every
 * shop page. Copy follows designs/screens/web/Home.png.
 */
import { asset, type Asset } from "@/lib/assets";

export type NavLink = { label: string; href: string };
export type SocialNetwork = "facebook" | "twitter" | "pinterest" | "instagram";

export const siteConfig = {
  name: "Ecofy",
  description:
    "Morbi cursus porttitor enim lobortis molestie. Duis gravida turpis dui, eget bibendum magna congue nec.",
  storeLocation: "Store Location: House 15, Road 7, Dhanmondi, Dhaka 1205",
  phone: { label: "(+880) 2-58812345", href: "tel:+880258812345" },
  email: { label: "hello@ecofy.com", href: "mailto:hello@ecofy.com" },
  // Display-only until i18n exists. Currencies: lib/money.ts CURRENCIES.
  languages: ["Eng", "Bangla"],
  mainNav: [
    { label: "Home", href: "/" },
    { label: "Shop", href: "/shop" },
    { label: "Blog", href: "/blog" },
    { label: "About Us", href: "/about" },
    { label: "Contact Us", href: "/contact" },
  ],
  footerGroups: [
    {
      title: "My Account",
      links: [
        { label: "My Account", href: "/account" },
        { label: "Order History", href: "/account/orders" },
        { label: "Shopping Cart", href: "/cart" },
        { label: "Wishlist", href: "/wishlist" },
      ],
    },
    {
      title: "Helps",
      links: [
        { label: "Contact", href: "/contact" },
        { label: "Faqs", href: "/faqs" },
        { label: "Terms & Condition", href: "/terms" },
        { label: "Privacy Policy", href: "/privacy" },
      ],
    },
    {
      title: "Proxy",
      links: [
        { label: "About", href: "/about" },
        { label: "Shop", href: "/shop" },
        { label: "Product", href: "/shop" },
        { label: "Track Order", href: "/account/orders" },
      ],
    },
    {
      title: "Categories",
      links: [
        { label: "Fruit & Vegetables", href: "/shop?category=fresh-vegetables" },
        { label: "Meat & Fish", href: "/shop?category=meat-fish" },
        { label: "Bread & Bakery", href: "/shop?category=bread-bakery" },
        { label: "Beauty & Health", href: "/shop?category=beauty-health" },
      ],
    },
  ],
  social: [
    { network: "facebook", label: "Facebook", href: "https://facebook.com" },
    { network: "twitter", label: "Twitter", href: "https://twitter.com" },
    { network: "pinterest", label: "Pinterest", href: "https://pinterest.com" },
    { network: "instagram", label: "Instagram", href: "https://instagram.com" },
  ],
  newsletter: {
    title: "Subscribe our Newsletter",
    description:
      "Pellentesque eu nibh eget mauris congue mattis mattis nec tellus. Phasellus imperdiet elit eu magna.",
    placeholder: "Your email address",
    cta: "Subscribe",
  },
  copyright: "Ecofy eCommerce © 2021. All Rights Reserved",
  paymentBadges: [
    { label: "Apple Pay", image: asset("payments", "apple-pay") },
    { label: "Visa", image: asset("payments", "visa") },
    { label: "Discover", image: asset("payments", "discover") },
    { label: "Mastercard", image: asset("payments", "mastercard") },
    { label: "Secure Payment", image: asset("payments", "secure-payment") },
  ],
} as const satisfies {
  name: string;
  description: string;
  storeLocation: string;
  phone: NavLink;
  email: NavLink;
  languages: readonly string[];
  mainNav: readonly NavLink[];
  footerGroups: readonly { title: string; links: readonly NavLink[] }[];
  social: readonly { network: SocialNetwork; label: string; href: string }[];
  newsletter: { title: string; description: string; placeholder: string; cta: string };
  copyright: string;
  paymentBadges: readonly { label: string; image: Asset }[];
};
