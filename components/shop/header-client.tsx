"use client";

import { HandbagIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { NavLink } from "@/lib/config/site";
import { useShopState } from "./shop-state";

/** True when `pathname` is `href` or below it ("/" only matches itself). */
export const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

type NavLinksProps = {
  links: readonly NavLink[];
  className?: string;
  linkClassName?: string;
};

/**
 * Main nav links with the current page highlighted. The pathname is URL data: on
 * dynamic routes (/product/[slug], /quick/[slug]) it isn't known while the shell is
 * prerendered, so the highlight streams in behind an identical, unhighlighted list.
 */
export function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<NavLinkList {...props} pathname={null} />}>
      <ActiveNavLinks {...props} />
    </Suspense>
  );
}

function ActiveNavLinks(props: NavLinksProps) {
  const pathname = usePathname();
  return <NavLinkList {...props} pathname={pathname} />;
}

function NavLinkList({ links, className, linkClassName, pathname }: NavLinksProps & { pathname: string | null }) {
  return (
    <ul className={className}>
      {links.map((l) => {
        const active = pathname !== null && isActive(pathname, l.href);
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "tap-target flex items-center font-medium transition-colors hover:text-primary",
                active ? "text-primary" : "text-text-body",
                linkClassName,
              )}
            >
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** Header cart: bag with count badge + "Shopping cart: $57.00" (optimistic). */
export function CartSummary() {
  const { ready, cart } = useShopState();
  return (
    <Link
      href="/cart"
      aria-label={ready ? `Shopping cart, ${cart.count} items, ${formatPrice(cart.totalCents)}` : "Shopping cart"}
      className="tap-target flex items-center gap-3"
    >
      <span className="relative">
        <HandbagIcon aria-hidden className="size-7 stroke-[1.5] text-foreground laptop:size-8" />
        <CartCountBadge />
      </span>
      <span className="hidden flex-col laptop:flex">
        <span className="text-[0.6875rem] leading-tight text-text-body">Shopping cart:</span>
        {ready ? (
          <span className="text-copy font-medium text-foreground">{formatPrice(cart.totalCents)}</span>
        ) : (
          <Skeleton className="mt-0.5 h-4 w-14" />
        )}
      </span>
    </Link>
  );
}

/** "Sign In / Sign Up" or "My Account" once the session is known. */
export function AuthLinks({ className }: { className?: string }) {
  const { ready, user } = useShopState();
  if (!ready) return <Skeleton className="h-3 w-24 bg-primary-foreground/30" />;
  if (user) {
    return (
      <Link href="/account" className={cn("tap-target flex items-center hover:underline", className)}>
        My Account
      </Link>
    );
  }
  return (
    <span className={cn("flex items-center gap-1", className)}>
      <Link href="/sign-in" className="tap-target flex items-center hover:underline">
        Sign In
      </Link>
      /
      <Link href="/sign-up" className="tap-target flex items-center hover:underline">
        Sign Up
      </Link>
    </span>
  );
}

/**
 * Item-count bubble on a cart icon (header bag and the tab bar's Cart tab). Reads the
 * optimistic store, so it updates the moment add-to-cart is pressed. Place it inside
 * a `relative` wrapper around the icon.
 */
export function CartCountBadge({ className }: { className?: string }) {
  const { ready, cart } = useShopState();
  if (!ready || cart.count <= 0) return null;
  return (
    <span
      aria-hidden
      // Re-mount on every count change → the bubble pops when something is added.
      key={cart.count}
      className={cn(
        "motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300",
        "absolute -top-1 -right-1.5 grid min-w-4.5 place-items-center rounded-full border border-background bg-brand-dark px-1 text-[0.625rem] leading-4 font-medium text-primary-foreground",
        className,
      )}
    >
      {cart.count > 99 ? "99+" : cart.count}
    </span>
  );
}
