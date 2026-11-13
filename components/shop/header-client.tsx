"use client";

import { ChevronLeftIcon, HeartIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { NavLink } from "@/lib/config/site";
import { useCart } from "./cart/cart-provider";
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

/** The bubble on header / tab-bar icons. Place it inside a `relative` wrapper. */
function CountBubble({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden
      // Re-mount on every count change → the bubble pops when something is added.
      key={count}
      className={cn(
        "motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300",
        "absolute -top-1 -right-1.5 grid min-w-4.5 place-items-center rounded-full border border-background bg-brand-dark px-1 text-[0.625rem] leading-4 font-medium text-primary-foreground",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Item-count bubble on a cart icon (header bag, mini cart triggers, the tab bar's
 * Cart tab). Reads the optimistic cart store, so it updates the moment
 * add-to-cart is pressed.
 */
export function CartCountBadge({ className }: { className?: string }) {
  const { ready, cart } = useCart();
  return ready ? <CountBubble count={cart.totals.count} className={className} /> : null;
}

/** Header heart: wishlist count (optimistic, guests included). */
export function WishlistLink() {
  const { ready, wishlist } = useShopState();
  const count = ready ? wishlist.size : 0;
  return (
    <Link
      href="/wishlist"
      aria-label={count > 0 ? `Wishlist, ${count} items` : "Wishlist"}
      className="tap-target hidden place-items-center text-foreground hover:text-primary laptop:grid"
    >
      <span className="relative">
        <HeartIcon aria-hidden className="size-8 stroke-[1.5]" />
        <CountBubble count={count} />
      </span>
    </Link>
  );
}

/**
 * Below laptop, sub-pages get a back chevron before the logo in the compact app
 * bar (account sub-pages, password reset). It goes to the parent screen, not
 * history, so a deep link still has somewhere sensible to go.
 */
export function backTarget(pathname: string): { href: string; label: string } | null {
  if (/^\/account\/orders\/[^/]+$/.test(pathname)) return { href: "/account/orders", label: "Back to orders" };
  if (pathname.startsWith("/account/")) return { href: "/account", label: "Back to account" };
  if (pathname === "/forgot-password" || pathname === "/reset-password") return { href: "/sign-in", label: "Back to sign in" };
  return null;
}

export function HeaderBackButton() {
  return (
    <Suspense fallback={null}>
      <ActiveBackButton />
    </Suspense>
  );
}

function ActiveBackButton() {
  const pathname = usePathname();
  const target = backTarget(pathname);
  if (!target) return null;
  return (
    <Link
      href={target.href}
      transitionTypes={["nav-back"]}
      aria-label={target.label}
      className="tap-target press -ml-3 grid place-items-center text-foreground laptop:hidden"
    >
      <ChevronLeftIcon aria-hidden className="size-6 stroke-[1.5]" />
    </Link>
  );
}
