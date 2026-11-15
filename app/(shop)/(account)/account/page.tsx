import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/shared/page-transition";
import {
  AccountMenu,
  BillingAddressCard,
  MobileProfileHeader,
  MobileRecentOrders,
  OrdersSkeleton,
  ProfileCard,
  ProfileSkeleton,
  RecentOrdersCard,
  StatsRail,
} from "@/components/shop/account/dashboard";
import { requireUser } from "@/lib/auth-guards";
import { getAccountProfile, getAccountStats, getDefaultBillingAddress } from "@/lib/queries/account";
import { getRecentOrders } from "@/lib/queries/orders";

/**
 * User Dashboard (designs/screens/web/User_Dashboard.png). Two streamed sections
 * (profile + address + stats, recent orders), each behind a same-shape skeleton.
 * Laptop+ is the PNG; below laptop the app profile screen (components/shop/account/dashboard.tsx).
 */
export const metadata: Metadata = { title: "Dashboard" };

export default function AccountDashboardPage() {
  return (
    <PageTransition>
      {/* Laptop+: the PNG has no visible title; below laptop the profile header is the h1. */}
      <h1 className="sr-only">Dashboard</h1>
      <div className="flex flex-col gap-6">
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfileSection />
        </Suspense>
        <Suspense fallback={<OrdersSkeleton />}>
          <RecentOrdersSection />
        </Suspense>
        <div className="laptop:hidden">
          <AccountMenu />
        </div>
      </div>
    </PageTransition>
  );
}

async function ProfileSection() {
  const user = await requireUser();
  const [profile, address, stats] = await Promise.all([
    getAccountProfile(user.id),
    getDefaultBillingAddress(user.id),
    getAccountStats(user.id),
  ]);
  if (!profile) return null;
  return (
    <>
      <div className="hidden grid-cols-[536fr_424fr] gap-6 laptop:grid">
        <ProfileCard profile={profile} />
        <BillingAddressCard address={address} />
      </div>
      <div className="flex flex-col gap-5 laptop:hidden">
        <MobileProfileHeader profile={profile} />
        <StatsRail stats={stats} />
      </div>
    </>
  );
}

async function RecentOrdersSection() {
  const user = await requireUser();
  const rows = await getRecentOrders(user.id, 6);
  return (
    <>
      <div className="hidden laptop:block">
        <RecentOrdersCard rows={rows} />
      </div>
      <div className="laptop:hidden">
        <MobileRecentOrders rows={rows.slice(0, 3)} />
      </div>
    </>
  );
}
