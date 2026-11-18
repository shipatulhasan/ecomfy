import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CacheTags } from "@/lib/cache-tags";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/checkout/settings";

/**
 * Store settings (COD rules, enabled gateways, USD rate) + shipping zones.
 * Cached; admin settings actions invalidate with `updateTag(CacheTags.settings)`.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  "use cache";
  cacheTag(CacheTags.settings);
  cacheLife("hours");

  const [row, zones] = await Promise.all([
    prisma.settings.findUnique({ where: { id: "default" } }),
    prisma.shippingZone.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  if (!row) return DEFAULT_SETTINGS;
  return {
    usdToBdtRate: row.usdToBdtRate.toNumber(),
    codEnabled: row.codEnabled,
    codFeeCents: row.codFeeCents,
    codMaxOrderCents: row.codMaxOrderCents,
    codAllowedDistricts: row.codAllowedDistricts,
    codMaxPerPhonePerDay: row.codMaxPerPhonePerDay,
    bkashEnabled: row.bkashEnabled,
    sslcommerzEnabled: row.sslcommerzEnabled,
    couriers: row.couriers.length ? row.couriers : DEFAULT_SETTINGS.couriers,
    courierTrackingUrls: stringRecord(row.courierTrackingUrls),
    returnWindowDays: row.returnWindowDays,
    zones: zones.length
      ? zones.map((z) => ({
          id: z.id,
          name: z.name,
          rateCents: z.rateCents,
          districts: z.districts,
          isFallback: z.isFallback,
          etaText: z.etaText,
        }))
      : DEFAULT_SETTINGS.zones,
  };
}

function stringRecord(json: unknown): Record<string, string> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return {};
  return Object.fromEntries(Object.entries(json).filter((e): e is [string, string] => typeof e[1] === "string"));
}
