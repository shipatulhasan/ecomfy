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
  /** Admin order Shipping card: courier choices. */
  couriers: string[];
  /** Courier → tracking URL template with `{tracking}` (optional per courier). */
  courierTrackingUrls: Record<string, string>;
  /** DELIVERED → RETURNED allowed for this many days. */
  returnWindowDays: number;
  /** Shipping is free when the discounted cart subtotal reaches this. null = never. */
  freeShippingThresholdCents: number | null;
  /** Unpaid gateway orders expire (stock released) after this many minutes. */
  pendingPaymentTtlMin: number;
  /** Admin uploads (Product Media, avatars, store logo). */
  maxUploadMb: number;
  allowedUploadTypes: string[];
  store: StoreProfile;
  seo: SeoDefaults;
};

/** The footer band's networks (Home.png newsletter band icons). */
export const SOCIAL_KEYS = ["facebook", "twitter", "pinterest", "instagram"] as const;
export type SocialKey = (typeof SOCIAL_KEYS)[number];

/** Admin Settings → Store: header, footer, invoices, emails. */
export type StoreProfile = {
  name: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  contactEmail: string;
  /** E.164-ish, digits with a leading + ("+880258812345"). */
  contactPhone: string;
  address: string;
  socialLinks: Partial<Record<SocialKey, string>>;
};

export type SeoDefaults = { titleTemplate: string; description: string; ogImageUrl: string | null };

export const DEFAULT_COURIERS = ["Pathao", "Steadfast", "RedX", "Sundarban", "eCourier"];

/** Tracking link from the courier's template, if one is configured. */
export function trackingUrlFor(settings: Pick<StoreSettings, "courierTrackingUrls">, courier: string, tracking: string): string | null {
  const template = settings.courierTrackingUrls[courier];
  if (!template?.includes("{tracking}")) return null;
  return template.replace("{tracking}", encodeURIComponent(tracking));
}

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
  couriers: DEFAULT_COURIERS,
  courierTrackingUrls: {},
  returnWindowDays: 7,
  freeShippingThresholdCents: null,
  pendingPaymentTtlMin: 30,
  maxUploadMb: 5,
  allowedUploadTypes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
  store: {
    name: "Ecofy",
    logoUrl: null,
    faviconUrl: null,
    contactEmail: "hello@ecofy.com",
    contactPhone: "+880258812345",
    address: "House 15, Road 7, Dhanmondi, Dhaka 1205",
    socialLinks: {},
  },
  seo: { titleTemplate: "%s · Ecomfy", description: "Fresh fruit, vegetables and organic groceries delivered.", ogImageUrl: null },
  zones: [
    { id: "default", name: "Standard delivery", rateCents: 12000, districts: [], isFallback: true, etaText: "3–5 days" },
  ],
};

/** "+880258812345" → "(+880) 2-58812345" style label (header / footer / invoice). */
export function phoneLabel(phone: string): string {
  const m = /^\+880(\d)(\d+)$/.exec(phone.replace(/[\s-]/g, ""));
  if (!m) return phone;
  return m[1] === "1" ? `(+880) 1${m[2]!.slice(0, 3)}-${m[2]!.slice(3)}` : `(+880) ${m[1]}-${m[2]}`;
}

/** The zone for a district: the first zone listing it, else the fallback zone. */
export function zoneFor(settings: StoreSettings, district: string | null | undefined): ShippingZoneRule | null {
  if (!district) return null;
  return (
    settings.zones.find((z) => z.districts.includes(district)) ??
    settings.zones.find((z) => z.isFallback) ??
    null
  );
}
