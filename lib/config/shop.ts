/**
 * Shop listing copy (designs/screens/web/Shop.png). Catalog data (categories,
 * counts, tags, brands, price bounds) comes from the DB, never from here.
 */
import { asset } from "@/lib/assets";
import type { ShopSort } from "@/lib/shop-params";

export const shopContent = {
  title: "Shop",
  description: "Fresh fruit, vegetables and everyday groceries, delivered from local farms.",
  crumbs: { home: "Home", categories: "Categories", shop: "Shop" },
  sort: {
    label: "Sort by:",
    options: [
      { value: "latest", label: "Latest" },
      { value: "popular", label: "Popularity" },
      { value: "rating", label: "Top rated" },
      { value: "price-asc", label: "Price: Low to High" },
      { value: "price-desc", label: "Price: High to Low" },
      { value: "name", label: "Name: A to Z" },
    ] satisfies { value: ShopSort; label: string }[],
  },
  results: { suffix: "Results Found", singular: "Result Found" },
  filters: {
    button: "Filter",
    sheetTitle: "Filters",
    showResults: "Show results",
    categories: "All Categories",
    price: "Price",
    priceLabel: "Price:",
    rating: "Rating",
    tags: "Popular Tag",
    brands: "Brands",
    availability: "Availability",
    inStock: "In stock only",
    active: "Active filters:",
    clearAll: "Clear all",
  },
  discount: {
    highlight: "79%",
    title: "Discount",
    subtitle: "on your first order",
    cta: { label: "Shop Now", href: "/shop?category=fresh-vegetables" },
    image: asset("banners", "shop-discount-bg"),
  },
  saleProducts: "Sale Products",
  empty: {
    title: "No products match your filters",
    description: "Try removing a filter or widening the price range.",
    cta: "Clear filters",
  },
  notFound: {
    title: "Category not found",
    description: "This category doesn't exist or has been removed.",
    cta: "Browse all products",
  },
};

export type ShopContent = typeof shopContent;
