import {
  ChevronRightIcon,
  HeartIcon,
  LogOutIcon,
  MapPinIcon,
  PackageIcon,
  SettingsIcon,
  ShoppingBagIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Rail, RailItem } from "@/components/shared/rail";
import { Skeleton } from "@/components/ui/skeleton";
import { laptopSizes } from "@/lib/image-sizes";
import type { AccountAddress, AccountProfile } from "@/lib/queries/account";
import type { OrderRow } from "@/lib/queries/orders";
import { NoOrders, OrderCards, OrdersTable } from "./orders-list";
import { SignOutButton } from "./sign-out-button";
import { UserAvatar } from "./user-avatar";
import { ROLE_LABELS } from "@/lib/auth/permissions";

/**
 * User_Dashboard.png, laptop+: Profile card (536×278) | Billing Address card
 * (424×278), 24 apart; then "Recent Order History" (984 wide, 6 rows).
 * Below laptop it's an app profile screen: avatar header, quick-stats rail,
 * recent orders as cards, then the menu list.
 */
const card = "rounded-lg border border-border bg-card";

export function ProfileCard({ profile }: { profile: AccountProfile }) {
  return (
    <section aria-label="Profile" className={`${card} flex flex-col items-center px-8 pt-8 pb-8 text-center`}>
      <UserAvatar name={profile.name} image={profile.image} sizes={`${laptopSizes(120)}, 7.5rem`} className="size-30 text-h2" />
      <h2 className="mt-2 text-h4 font-medium text-foreground">{profile.name}</h2>
      <p className="text-copy text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
      <Link href="/account/settings" className="mt-4 text-lead font-medium text-primary hover:text-brand-dark hover:underline">
        Edit Profile
      </Link>
    </section>
  );
}

export function BillingAddressCard({ address }: { address: AccountAddress | null }) {
  return (
    <section aria-labelledby="billing-title" className={`${card} flex flex-col px-8 pt-8 pb-8`}>
      <h2 id="billing-title" className="text-copy font-medium tracking-wide text-muted-foreground uppercase">
        Billing Address
      </h2>
      {address ? (
        <div className="mt-4 flex flex-col">
          <p className="text-h4 font-normal text-foreground">
            {address.firstName} {address.lastName}
          </p>
          <p className="mt-2 max-w-66 text-copy text-text-subtle">
            {[address.street, address.city, address.district].filter(Boolean).join(", ")} {address.zip}
          </p>
          <p className="mt-2 text-lead break-all text-foreground">{address.email}</p>
          <p className="mt-1.5 text-lead text-foreground">{address.phone}</p>
        </div>
      ) : (
        <p className="mt-4 text-copy text-text-subtle">No billing address yet. Add one to check out faster.</p>
      )}
      <Link
        href="/account/settings#billing"
        className="mt-auto pt-4 text-lead font-medium text-primary hover:text-brand-dark hover:underline"
      >
        {address ? "Edit Address" : "Add Address"}
      </Link>
    </section>
  );
}

export function RecentOrdersCard({ rows }: { rows: OrderRow[] }) {
  return (
    <section aria-labelledby="recent-orders-title" className={`${card} overflow-hidden pb-3`}>
      <div className="flex items-center justify-between px-6 py-4">
        <h2 id="recent-orders-title" className="text-h4 font-medium text-foreground">
          Recent Order History
        </h2>
        <Link href="/account/orders" className="text-lead font-medium text-primary hover:text-brand-dark hover:underline">
          View All
        </Link>
      </div>
      {rows.length > 0 ? <OrdersTable rows={rows} /> : <NoOrders />}
    </section>
  );
}

// ───────────────────────── below laptop: app profile screen ─────────────────────────

export function MobileProfileHeader({ profile }: { profile: AccountProfile }) {
  return (
    <section aria-label="Profile" className="flex items-center gap-4">
      <UserAvatar name={profile.name} image={profile.image} sizes="4.5rem" className="size-18 text-h3" />
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-h3 text-foreground">{profile.name}</h2>
        <p className="truncate text-copy text-text-subtle">{profile.email}</p>
      </div>
      <Link
        href="/account/settings"
        className="tap-target press grid place-items-center rounded-full text-copy font-medium text-primary"
      >
        Edit
      </Link>
    </section>
  );
}

export function StatsRail({ stats }: { stats: { orders: number; wishlist: number; cart: number } }) {
  const tiles: { label: string; value: number; href: string; icon: LucideIcon }[] = [
    { label: "Orders", value: stats.orders, href: "/account/orders", icon: PackageIcon },
    { label: "Wishlist", value: stats.wishlist, href: "/wishlist", icon: HeartIcon },
    { label: "In cart", value: stats.cart, href: "/cart", icon: ShoppingBagIcon },
  ];
  return (
    <Rail size="stat" aria-label="Quick stats">
      {tiles.map(({ label, value, href, icon: Icon }) => (
        <RailItem key={href}>
          <Link
            href={href}
            transitionTypes={["nav-forward"]}
            className="press flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4"
          >
            <Icon aria-hidden className="size-5 text-primary" />
            <span className="text-h3 text-foreground tabular-nums">{value}</span>
            <span className="text-caption text-text-subtle">{label}</span>
          </Link>
        </RailItem>
      ))}
    </Rail>
  );
}

export function MobileRecentOrders({ rows }: { rows: OrderRow[] }) {
  return (
    <section aria-labelledby="m-recent-orders" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 id="m-recent-orders" className="text-h4 text-foreground">
          Recent orders
        </h2>
        {rows.length > 0 && (
          <Link href="/account/orders" className="tap-target flex items-center text-copy font-medium text-primary">
            View all
          </Link>
        )}
      </div>
      {rows.length > 0 ? <OrderCards rows={rows} /> : <NoOrders className={`${card} py-8`} />}
    </section>
  );
}

const menu: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Orders", href: "/account/orders", icon: PackageIcon },
  { label: "Wishlist", href: "/wishlist", icon: HeartIcon },
  { label: "Addresses", href: "/account/settings#billing", icon: MapPinIcon },
  { label: "Settings", href: "/account/settings", icon: SettingsIcon },
];

const menuRow = "press flex min-h-14 w-full items-center gap-3 px-4 text-lead";

/** The account menu below laptop (replaces the sidebar). */
export function AccountMenu() {
  return (
    <nav aria-label="Account" className={`${card} divide-y divide-border overflow-hidden`}>
      {menu.map(({ label, href, icon: Icon }) => (
        <Link key={label} href={href} transitionTypes={["nav-forward"]} className={`${menuRow} text-foreground`}>
          <Icon aria-hidden className="size-5 text-muted-foreground" />
          <span className="flex-1">{label}</span>
          <ChevronRightIcon aria-hidden className="size-5 text-muted-foreground" />
        </Link>
      ))}
      <SignOutButton className={`${menuRow} text-sale`}>
        <LogOutIcon aria-hidden className="size-5" />
        <span className="flex-1 text-left">Log out</span>
      </SignOutButton>
    </nav>
  );
}

// ───────────────────────── skeletons (same geometry) ─────────────────────────

export function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading your profile">
      <div className="hidden grid-cols-[536fr_424fr] gap-6 laptop:grid">
        <Skeleton className="h-69.5 rounded-lg" />
        <Skeleton className="h-69.5 rounded-lg" />
      </div>
      <div className="flex flex-col gap-4 laptop:hidden">
        <div className="flex items-center gap-4">
          <Skeleton className="size-18 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-52" />
          </div>
        </div>
        <div className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 flex-1 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function OrdersSkeleton({ rows = 6, bare = false }: { rows?: number; bare?: boolean }) {
  const tableRows = (
    <>
      <Skeleton className="h-9 rounded-none" />
      <div className="flex flex-col gap-0 px-6 py-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex h-11.25 items-center gap-6">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="ml-24 h-4 w-24" />
            <Skeleton className="ml-12 h-4 w-36" />
            <Skeleton className="ml-auto h-4 w-20" />
          </div>
        ))}
      </div>
    </>
  );
  return (
    <div role="status" aria-label="Loading your orders">
      {bare ? (
        <div className="hidden flex-col laptop:flex">{tableRows}</div>
      ) : (
        <div className={`${card} hidden flex-col gap-0 overflow-hidden laptop:flex`}>
          <div className="flex h-15.5 items-center justify-between px-6">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-5 w-16" />
          </div>
          {tableRows}
        </div>
      )}
      <div className="flex flex-col gap-3 laptop:hidden">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`${card} flex flex-col gap-3 p-4`}>
            <div className="flex justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex gap-2">
              {[0, 1, 2].map((j) => (
                <Skeleton key={j} className="size-12 rounded-md" />
              ))}
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
