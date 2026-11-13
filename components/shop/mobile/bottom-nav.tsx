"use client";

import { HandbagIcon, HouseIcon, SearchIcon, StoreIcon, UserRoundIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";
import { CartCountBadge, isActive } from "../header-client";
import { useShopState } from "../shop-state";

type Tab = { label: string; href: string; icon: LucideIcon; also?: readonly string[] };

const tabs: readonly Tab[] = [
  { label: "Home", href: "/", icon: HouseIcon },
  { label: "Shop", href: "/shop", icon: StoreIcon, also: ["/product"] },
  { label: "Search", href: "/search", icon: SearchIcon },
  { label: "Cart", href: "/cart", icon: HandbagIcon },
  { label: "Account", href: "/account", icon: UserRoundIcon, also: ["/wishlist"] },
];

/** Routes that hide the tab bar (focused flows with their own sticky action). */
const HIDDEN_ON = ["/checkout"] as const;

/**
 * Native-style tab bar, mobile/tablet only (`laptop:hidden`). Laptop and desktop use
 * the full header nav from the PNG.
 *
 * - Fixed to the bottom, 64px tall (including the 1px top border) plus the home-indicator safe area. It's
 *   translucent with a blur, and anchored during page transitions.
 * - `body` gets matching bottom padding through `--app-bottom-nav`
 *   (app/globals.css), which is only set while this element is in the DOM.
 * - It hides itself while a text field has focus (on-screen keyboard), in CSS, and
 *   isn't rendered on checkout.
 * - The Cart badge reads the same optimistic store as the header.
 */
export function BottomNav() {
  // The pathname is URL data: on dynamic routes (/product/[slug], /quick/[slug]) the
  // prerendered shell gets the bar without an active tab, and the highlight streams in.
  return (
    <Suspense fallback={<BottomNavBar pathname={null} />}>
      <ActiveBottomNav />
    </Suspense>
  );
}

function ActiveBottomNav() {
  const pathname = usePathname();
  if (HIDDEN_ON.some((p) => isActive(pathname, p))) return null;
  return <BottomNavBar pathname={pathname} />;
}

function BottomNavBar({ pathname }: { pathname: string | null }) {
  const { ready, cart } = useShopState();

  return (
    <nav
      data-slot="bottom-nav"
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-md select-none [view-transition-name:bottom-nav] laptop:hidden"
    >
      <ul className="mx-auto grid h-[calc(4rem-1px)] max-w-xl grid-cols-5 pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
        {tabs.map(({ label, href, icon: Icon, also = [] }) => {
          const active = pathname !== null && [href, ...also].some((h) => isActive(pathname, h));
          const isCart = href === "/cart";
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                aria-label={isCart && ready && cart.count > 0 ? `Cart, ${cart.count} items` : undefined}
                className={cn(
                  "tap-target press flex flex-1 flex-col items-center justify-center gap-1 text-[0.6875rem] leading-none font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <Icon aria-hidden className={cn("size-6", active ? "stroke-2" : "stroke-[1.5]")} />
                  {isCart && <CartCountBadge />}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
