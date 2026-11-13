/**
 * Store settings shape (serializable: crosses to client leaves). Pure, no
 * server-only: the checkout form reuses it to show which methods are available.
 */
import { DEFAULT_USD_RATE } from "@/lib/money";

export type ShippingZoneRule = {
  id: string;
  name: string;
  rateCents: number;
  districts: string[];
  isFallback: boolean;
  etaText: string;
};

export type StoreSettings = {
  /** BDT per 1 USD (display only). */
  usdToBdtRate: number;
  codEnabled: boolean;
  codFeeCents: number;
  codMaxOrderCents: number | null;
  /** Empty = every district. */
  codAllowedDistricts: string[];
  codMaxPerPhonePerDay: number;
  bkashEnabled: boolean;
  sslcommerzEnabled: boolean;
  zones: ShippingZoneRule[];
};

/** Used when the settings row is missing (fresh DB before seeding). */
export const DEFAULT_SETTINGS: StoreSettings = {
  usdToBdtRate: DEFAULT_USD_RATE,
  codEnabled: true,
  codFeeCents: 0,
  codMaxOrderCents: null,
  codAllowedDistricts: [],
  codMaxPerPhonePerDay: 3,
  bkashEnabled: true,
  sslcommerzEnabled: true,
  zones: [
    { id: "default", name: "Standard delivery", rateCents: 12000, districts: [], isFallback: true, etaText: "3–5 days" },
  ],
};

/** The zone for a district: the first zone listing it, else the fallback zone. */
export function zoneFor(settings: StoreSettings, district: string | null | undefined): ShippingZoneRule | null {
  if (!district) return null;
  return (
    settings.zones.find((z) => z.districts.includes(district)) ??
    settings.zones.find((z) => z.isFallback) ??
    null
  );
}
