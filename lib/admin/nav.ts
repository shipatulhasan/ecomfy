import {
  BlendIcon,
  CirclePlusIcon,
  CreditCardIcon,
  HouseIcon,
  ImageIcon,
  LockKeyholeIcon,
  type LucideIcon,
  PackageSearchIcon,
  SettingsIcon,
  ShoppingCartIcon,
  StoreIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react";
import { can, type Permission } from "@/lib/auth/permissions";

/**
 * The admin menu (Nav.png), the single source for the sidebar, the topbar title,
 * the Coming soon catch-all and the permission filter. A new admin page only adds
 * (or already has) an entry here.
 *
 * Plain data + icon components: imported by client leaves directly (icons can't be
 * passed as props across the server/client boundary).
 */
export type AdminBadgeKey = "pendingOrders" | "paymentsAttention";

export type AdminNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from staff without it (pages and actions re-check it). */
  permission: Permission | null;
  badge?: AdminBadgeKey;
  /** Opens outside the admin (new tab), with the external-link glyph. */
  external?: boolean;
  /** Exact-match only for the active state (Dashboard = /admin). */
  exact?: boolean;
};

export type AdminNavGroup = { label: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: "Main Menu", // the PNG reads "Main Manu"
    items: [
      { label: "Dashboard", href: "/admin", icon: HouseIcon, permission: "dashboard:read", exact: true },
      { label: "Order Management", href: "/admin/orders", icon: ShoppingCartIcon, permission: "orders:read", badge: "pendingOrders" },
      { label: "Customers", href: "/admin/customers", icon: UsersIcon, permission: "customers:read" },
      { label: "Coupon Code", href: "/admin/coupons", icon: TicketIcon, permission: "coupons:write" },
      { label: "Categories", href: "/admin/categories", icon: BlendIcon, permission: "categories:read" },
      { label: "Transaction", href: "/admin/transactions", icon: CreditCardIcon, permission: "payments:read", badge: "paymentsAttention" },
    ],
  },
  {
    label: "Product",
    items: [
      { label: "Add Products", href: "/admin/products/new", icon: CirclePlusIcon, permission: "products:write", exact: true },
      { label: "Product Media", href: "/admin/media", icon: ImageIcon, permission: "products:write" },
      { label: "Product List", href: "/admin/products", icon: PackageSearchIcon, permission: "products:read" },
    ],
  },
  {
    label: "Settings & Preferences",
    items: [
      { label: "General Info", href: "/admin/settings", icon: SettingsIcon, permission: null },
      { label: "Control Authority", href: "/admin/control-authority", icon: LockKeyholeIcon, permission: "users:manage" },
      { label: "Your Store", href: "/", icon: StoreIcon, permission: null, external: true },
    ],
  },
];

const ALL_ITEMS = ADMIN_NAV.flatMap((g) => g.items);

/** Hrefs of the items this user may see (passed to the client sidebar). */
export function allowedNavHrefs(user: { role?: string | null }): string[] {
  return ALL_ITEMS.filter((i) => i.permission === null || can(user, i.permission)).map((i) => i.href);
}

function matches(item: AdminNavItem, pathname: string) {
  if (item.external) return false;
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** The menu item a path belongs to; the longest href wins (/admin/products/new over /admin/products). */
export function navItemFor(pathname: string): AdminNavItem | null {
  let best: AdminNavItem | null = null;
  for (const item of ALL_ITEMS) {
    if (!matches(item, pathname)) continue;
    if (!best || item.href.length > best.href.length) best = item;
  }
  return best;
}

/** Item (if any) whose section a not-yet-built path falls under, for the Coming soon catch-all. */
export function navSectionFor(pathname: string): AdminNavItem | null {
  return (
    navItemFor(pathname) ??
    ALL_ITEMS.find((i) => !i.external && i.href !== "/admin" && pathname.startsWith(`${i.href}/`)) ??
    null
  );
}
