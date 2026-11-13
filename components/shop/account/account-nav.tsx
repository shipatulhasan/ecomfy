"use client";

import {
  HeartIcon,
  LayoutGridIcon,
  LogOutIcon,
  RefreshCwIcon,
  SettingsIcon,
  ShoppingBagIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

type Item = { label: string; href: string; icon: LucideIcon; exact?: boolean };

export const accountNavItems: readonly Item[] = [
  { label: "Dashboard", href: "/account", icon: LayoutGridIcon, exact: true },
  { label: "Order History", href: "/account/orders", icon: RefreshCwIcon },
  { label: "Wishlist", href: "/wishlist", icon: HeartIcon },
  { label: "Shopping Cart", href: "/cart", icon: ShoppingBagIcon },
  { label: "Settings", href: "/account/settings", icon: SettingsIcon },
];

const isActive = (pathname: string, { href, exact }: Item) =>
  exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

const row =
  "relative flex h-14.5 w-full items-center gap-2 px-5 text-lead transition-colors hover:text-foreground";

/**
 * "Navigation" card (Figma "Dashboard Navigation" 312×418), laptop+ only. The
 * active item gets a muted background and a primary bar on the left edge. Below
 * laptop the account screens have no sidebar: the dashboard is the menu and
 * sub-pages get a back button in the app bar.
 */
export function AccountNav() {
  return (
    <nav aria-label="Account" className="rounded-lg border border-border bg-card pb-3">
      <h2 className="px-5 pt-6 pb-4 text-h4 font-medium text-foreground">Navigation</h2>
      <Suspense fallback={<NavList pathname={null} />}>
        <ActiveNavList />
      </Suspense>
    </nav>
  );
}

function ActiveNavList() {
  return <NavList pathname={usePathname()} />;
}

function NavList({ pathname }: { pathname: string | null }) {
  return (
    <ul>
      {accountNavItems.map((item) => {
        const active = pathname !== null && isActive(pathname, item);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                row,
                active
                  ? "bg-muted-strong text-foreground before:absolute before:inset-y-0 before:left-0 before:w-0.75 before:bg-primary"
                  : "text-text-subtle",
              )}
            >
              <Icon aria-hidden className={cn("size-6 stroke-[1.5]", active ? "text-foreground" : "text-muted-foreground")} />
              {item.label}
            </Link>
          </li>
        );
      })}
      <li>
        <SignOutButton className={cn(row, "text-text-subtle")}>
          <LogOutIcon aria-hidden className="size-6 stroke-[1.5] text-muted-foreground" />
          Log-out
        </SignOutButton>
      </li>
    </ul>
  );
}
