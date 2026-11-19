import { z } from "zod";
import { SOCIAL_KEYS } from "@/lib/checkout/settings";
import { isDistrict } from "@/lib/config/districts";
import { UPLOAD_MIME } from "@/lib/media/upload-rules";

/**
 * Admin Settings → store sections. Each section saves on its own (one schema
 * each). Money is entered in whole taka and stored as cents.
 */

const taka = (max = 10_000_000) =>
  z.coerce.number({ error: "Enter an amount" }).int("Whole taka only").min(0, "Can't be negative").max(max, "Too large");
const optionalTaka = (max = 10_000_000) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), taka(max).nullable());
const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => /^https:\/\/[^\s]+$/i.test(v), "Use a full https:// link");
const districts = z.array(z.string()).max(64).refine((ds) => ds.every(isDistrict), "Unknown district");

export const storeSectionSchema = z.object({
  storeName: z.string().trim().min(2, "At least 2 characters").max(60),
  contactEmail: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  contactPhone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .pipe(z.string().regex(/^\+?880\d{8,10}$|^0\d{9,10}$/, "Enter a Bangladesh phone number"))
    .transform((v) => (v.startsWith("+") ? v : v.startsWith("880") ? `+${v}` : `+88${v}`)),
  address: z.string().trim().min(5, "Enter the store address").max(200),
  socialLinks: z.object(Object.fromEntries(SOCIAL_KEYS.map((k) => [k, z.union([z.literal(""), httpsUrl]).optional()]))).transform((o) =>
    Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== "")),
  ),
});

export const zoneSchema = z.object({
  id: z.string().max(64).optional(),
  name: z.string().trim().min(2, "Name the zone").max(60),
  rate: taka(100_000),
  districts,
  etaText: z.string().trim().min(1, "e.g. 1–2 days").max(40),
  isFallback: z.boolean(),
});

export const shippingSectionSchema = z
  .object({
    freeShippingThreshold: optionalTaka(),
    zones: z.array(zoneSchema).min(1, "Add at least one zone").max(20),
  })
  .superRefine((v, ctx) => {
    const fallbacks = v.zones.filter((z) => z.isFallback).length;
    if (fallbacks !== 1) ctx.addIssue({ code: "custom", path: ["zones"], message: "Exactly one zone must cover “all other districts”." });
    const seen = new Map<string, string>();
    v.zones.forEach((z, i) => {
      if (!z.isFallback && z.districts.length === 0) {
        ctx.addIssue({ code: "custom", path: ["zones", i, "districts"], message: "Pick at least one district" });
      }
      for (const d of z.districts) {
        const other = seen.get(d);
        if (other) ctx.addIssue({ code: "custom", path: ["zones", i, "districts"], message: `${d} is already in “${other}”` });
        else seen.set(d, z.name);
      }
    });
  });

export const paymentsSectionSchema = z.object({
  bkashEnabled: z.boolean(),
  sslcommerzEnabled: z.boolean(),
  codEnabled: z.boolean(),
  codFee: taka(10_000),
  codMax: optionalTaka(),
  codAllowedDistricts: districts,
  codMaxPerPhonePerDay: z.coerce.number().int().min(1, "At least 1").max(50),
  usdToBdtRate: z.coerce.number({ error: "Enter a rate" }).min(1, "Too low").max(1000, "Too high"),
});

export const courierSchema = z.object({
  name: z.string().trim().min(2, "Name the courier").max(40),
  trackingUrl: z.union([
    z.literal(""),
    httpsUrl.refine((v) => v.includes("{tracking}"), "Put {tracking} where the tracking number goes"),
  ]),
});

export const couriersSectionSchema = z.object({
  couriers: z
    .array(courierSchema)
    .min(1, "Add at least one courier")
    .max(20)
    .refine((cs) => new Set(cs.map((c) => c.name.toLowerCase())).size === cs.length, "Courier names must be unique"),
});

export const ordersMediaSectionSchema = z.object({
  pendingPaymentTtlMin: z.coerce.number().int().min(5, "At least 5 minutes").max(1440, "At most 24 hours"),
  returnWindowDays: z.coerce.number().int().min(0).max(90, "At most 90 days"),
  maxUploadMb: z.coerce.number().int().min(1, "At least 1 MB").max(20, "At most 20 MB"),
  allowedUploadTypes: z
    .array(z.enum(Object.keys(UPLOAD_MIME) as [keyof typeof UPLOAD_MIME, ...(keyof typeof UPLOAD_MIME)[]]))
    .min(1, "Allow at least one type"),
});

export const seoSectionSchema = z.object({
  seoTitleTemplate: z
    .string()
    .trim()
    .max(70)
    .refine((v) => v.includes("%s"), "Keep %s where the page title goes"),
  seoDescription: z.string().trim().min(20, "At least 20 characters").max(160, "At most 160 characters (search results cut the rest)"),
});

export const storeImageSchema = z.object({
  purpose: z.enum(["logo", "favicon", "og"]),
  /** tmp/ key from the presigned upload; null removes the image. */
  key: z.string().max(80).nullable(),
});

export const SETTINGS_SECTIONS = ["store", "shipping", "payments", "couriers", "orders", "seo"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
