import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotificationsTab } from "@/components/admin/settings/notifications-tab";
import { ProfileTab } from "@/components/admin/settings/profile-tab";
import { SecurityTab, type SessionRow } from "@/components/admin/settings/security-tab";
import { SettingsTabs } from "@/components/admin/settings/settings-tabs";
import { CouriersForm, OrdersMediaForm, PaymentsForm, SeoForm, ShippingForm, StoreForm, type GatewayModes } from "@/components/admin/settings/store-forms";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDhaka } from "@/lib/admin/date-range";
import { readNotificationPrefs } from "@/lib/admin/notifications";
import { parseSettingsTab, SETTINGS_TABS, type SettingsTabKey } from "@/lib/admin/settings-tabs";
import { can } from "@/lib/auth/permissions";
import { getSession, requireStaff, type CurrentUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { getStoreSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "General Info" };

/**
 * General Info (Account & Settings.png = the admin's PERSONAL account) at
 * /admin/settings?tab=. Profile is the PNG; Security, Notifications and the
 * store tabs (settings:write) are derived in the same card kit. Every tab reads
 * fresh data (request time, inside Suspense); store tabs read the cached
 * settings that their actions expire.
 */
export default function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/admin/settings">, "searchParams">) {
  const user = await requireStaff("/admin/settings");
  const tab = parseSettingsTab((await searchParams).tab);
  const def = SETTINGS_TABS.find((t) => t.key === tab);
  if (!tab || !def || (def.permission && !can(user, def.permission))) return <Forbidden />;

  return (
    <Container variant="admin" className="flex flex-col gap-5 py-5">
      <SettingsTabs active={tab} user={user} />
      <Suspense key={tab} fallback={<TabSkeleton />}>
        <Tab tab={tab} user={user} />
      </Suspense>
    </Container>
  );
}

async function Tab({ tab, user }: { tab: SettingsTabKey; user: CurrentUser }) {
  await connection();
  switch (tab) {
    case "profile": {
      const [row, settings] = await Promise.all([
        prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { name: true, email: true, emailVerified: true, image: true, phone: true, dateOfBirth: true, location: true, bio: true },
        }),
        getStoreSettings(),
      ]);
      const [firstName = "", ...rest] = row.name.trim().split(/\s+/);
      return (
        <ProfileTab
          maxMb={settings.maxUploadMb}
          profile={{
            firstName,
            lastName: rest.join(" "),
            email: row.email,
            emailVerified: row.emailVerified,
            image: row.image,
            phone: row.phone ?? "",
            dateOfBirth: row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : "",
            location: row.location ?? "",
            bio: row.bio ?? "",
            roleName: user.staffRoleName ?? "Staff",
          }}
        />
      );
    }
    case "security": {
      const [row, sessions, current] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { twoFactorEnabled: true } }),
        prisma.session.findMany({
          where: { userId: user.id, expiresAt: { gt: new Date() } },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: { id: true, userAgent: true, ipAddress: true, updatedAt: true, createdAt: true },
        }),
        getSession(),
      ]);
      const rows: SessionRow[] = sessions.map((s) => ({
        id: s.id,
        ...describeAgent(s.userAgent),
        ip: s.ipAddress,
        lastActive: formatDhaka(s.updatedAt, "dd MMM, h:mm a"),
        createdAt: formatDhaka(s.createdAt, "dd MMM yyyy"),
        current: s.id === current?.session.id,
      }));
      return <SecurityTab twoFactorEnabled={row.twoFactorEnabled} sessions={rows} />;
    }
    case "notifications": {
      const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { notificationPrefs: true, email: true } });
      return <NotificationsTab prefs={readNotificationPrefs(row.notificationPrefs)} email={row.email} />;
    }
  }
  const settings = await getStoreSettings();
  switch (tab) {
    case "store":
      return <StoreForm settings={settings} />;
    case "shipping":
      return <ShippingForm settings={settings} />;
    case "payments":
      return <PaymentsForm settings={settings} modes={gatewayModes()} />;
    case "couriers":
      return <CouriersForm settings={settings} />;
    case "orders":
      return <OrdersMediaForm settings={settings} />;
    case "seo":
      return <SeoForm settings={settings} />;
  }
}

/** Read-only from env; credentials themselves are never read into the page. */
function gatewayModes(): GatewayModes {
  const bkashUrl = process.env.BKASH_BASE_URL;
  const sslId = process.env.SSLCZ_STORE_ID;
  const sslLive = process.env.SSLCZ_IS_LIVE;
  return {
    bkash: !bkashUrl ? "missing" : /sandbox/i.test(bkashUrl) ? "sandbox" : "live",
    sslcommerz: !sslId ? "missing" : sslLive === "true" || sslLive === "1" ? "live" : "sandbox",
  };
}

/** Rough "Chrome on Windows" from a user agent (display only). */
function describeAgent(ua: string | null): { device: string; kind: SessionRow["kind"] } {
  if (!ua) return { device: "Unknown device", kind: "other" };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return { device: `${browser} on ${os}`, kind: /Mobile|Android|iPhone/.test(ua) ? "mobile" : os === "Unknown OS" ? "other" : "desktop" };
}

function TabSkeleton() {
  return (
    <div className="grid gap-5 laptop:grid-cols-[23.5rem_minmax(0,1fr)]">
      <Skeleton className="h-100 rounded-xl" />
      <Skeleton className="h-150 rounded-xl" />
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-5 py-5">
      <Skeleton className="h-10 w-full max-w-180 rounded-lg" />
      <TabSkeleton />
    </Container>
  );
}
