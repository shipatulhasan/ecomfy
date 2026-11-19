import type { Permission } from "@/lib/auth/permissions";

/**
 * Admin General Info (/admin/settings?tab=): the PNG's personal account (Profile)
 * plus derived tabs. Store tabs need settings:write (Super Admin).
 */
export const SETTINGS_TABS = [
  { key: "profile", label: "Profile", permission: null },
  { key: "security", label: "Security", permission: null },
  { key: "notifications", label: "Notifications", permission: null },
  { key: "store", label: "Store", permission: "settings:write" },
  { key: "shipping", label: "Shipping", permission: "settings:write" },
  { key: "payments", label: "Payments", permission: "settings:write" },
  { key: "couriers", label: "Couriers", permission: "settings:write" },
  { key: "orders", label: "Orders & Media", permission: "settings:write" },
  { key: "seo", label: "SEO", permission: "settings:write" },
] as const satisfies readonly { key: string; label: string; permission: Permission | null }[];

export type SettingsTabKey = (typeof SETTINGS_TABS)[number]["key"];

export function parseSettingsTab(v: string | string[] | undefined): SettingsTabKey | null {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s) return "profile";
  return (SETTINGS_TABS.find((t) => t.key === s)?.key as SettingsTabKey | undefined) ?? null;
}

export const settingsHref = (tab: SettingsTabKey) => (tab === "profile" ? "/admin/settings" : `/admin/settings?tab=${tab}`);
