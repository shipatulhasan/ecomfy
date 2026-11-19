import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { prisma } from "@/lib/db";
import { CacheTags } from "@/lib/cache-tags";
import { DEFAULT_SETTINGS, SOCIAL_KEYS, type StoreSettings } from "@/lib/checkout/settings";

/**
 * Store settings (store profile, COD rules, enabled gateways, USD rate, upload
 * rules, SEO defaults) + shipping zones.
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
    freeShippingThresholdCents: row.freeShippingThresholdCents,
    pendingPaymentTtlMin: row.pendingPaymentTtlMin,
    maxUploadMb: row.maxUploadMb,
    allowedUploadTypes: row.allowedUploadTypes.length ? row.allowedUploadTypes : DEFAULT_SETTINGS.allowedUploadTypes,
    store: {
      name: row.storeName,
      logoUrl: row.logoUrl,
      faviconUrl: row.faviconUrl,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      address: row.address,
      socialLinks: Object.fromEntries(Object.entries(stringRecord(row.socialLinks)).filter(([k]) => (SOCIAL_KEYS as readonly string[]).includes(k))),
    },
    seo: { titleTemplate: row.seoTitleTemplate, description: row.seoDescription, ogImageUrl: row.ogImageUrl },
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
