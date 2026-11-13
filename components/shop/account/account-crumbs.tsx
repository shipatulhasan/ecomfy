"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { PageHeroCrumbs, type Crumb } from "@/components/shop/page-hero-crumbs";

/** Account › Dashboard / Order History / Order Detail / Settings, from the URL. */
export function accountCrumbs(pathname: string | null): Crumb[] {
  const base: Crumb[] = [{ label: "Home", href: "/" }, { label: "Account", href: "/account" }];
  if (!pathname || pathname === "/account") return [...base, { label: "Dashboard" }];
  if (pathname === "/account/orders") return [...base, { label: "Order History" }];
  if (pathname.startsWith("/account/orders/"))
    return [...base, { label: "Order History", href: "/account/orders" }, { label: "Order Detail" }];
  if (pathname.startsWith("/account/settings")) return [...base, { label: "Settings" }];
  return base;
}

export function AccountCrumbs() {
  return (
    <Suspense fallback={<PageHeroCrumbs crumbs={accountCrumbs(null)} />}>
      <ActiveCrumbs />
    </Suspense>
  );
}

function ActiveCrumbs() {
  return <PageHeroCrumbs crumbs={accountCrumbs(usePathname())} />;
}
