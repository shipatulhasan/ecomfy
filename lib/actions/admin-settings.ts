"use server";

import { updateTag } from "next/cache";
import { logAudit } from "@/lib/audit";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { deleteStoredImage, finalizeImage, presignTmpImage } from "@/lib/media/single-image";
import { uploadRequestSchema } from "@/lib/validations/admin-product";
import {
  couriersSectionSchema,
  ordersMediaSectionSchema,
  paymentsSectionSchema,
  seoSectionSchema,
  shippingSectionSchema,
  storeImageSchema,
  storeSectionSchema,
  type SettingsSection,
} from "@/lib/validations/admin-settings";
import { ActionError, type ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Admin Settings → store sections (settings:write = Super Admin). Each section
 * saves only its own fields, logs an audit entry with the changed keys
 * (before / after) and expires the `settings` tag, so the storefront, checkout and
 * order screens read the new values on their next request (updateTag:
 * read-your-own-writes). Gateway credentials stay in env and never pass here.
 */

const ID = "default";
type Fields = Record<string, unknown>;

/** Read → write → audit (changed keys only) → updateTag. */
async function saveSection(actorId: string, section: SettingsSection, data: Fields, extra?: (tx: Prisma.TransactionClient) => Promise<{ before: Fields; after: Fields } | null>) {
  const keys = Object.keys(data);
  await prisma.$transaction(async (tx) => {
    const row = await tx.settings.findUnique({ where: { id: ID } });
    const before: Fields = {};
    const after: Fields = {};
    for (const k of keys) {
      const prev = row ? normalize((row as Fields)[k]) : null;
      const next = normalize(data[k]);
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        before[k] = prev;
        after[k] = next;
      }
    }
    if (keys.length) {
      await tx.settings.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
    }
    const more = extra ? await extra(tx) : null;
    if (more) {
      Object.assign(before, more.before);
      Object.assign(after, more.after);
    }
    if (Object.keys(after).length === 0 && Object.keys(before).length === 0) return;
    await logAudit(
      { actorId, action: "settings.update", entity: "Settings", entityId: section, before: before as Prisma.InputJsonValue, after: after as Prisma.InputJsonValue },
      tx,
    );
  });
  updateTag(CacheTags.settings);
}

const normalize = (v: unknown): unknown => (v instanceof Prisma.Decimal ? v.toNumber() : v === undefined ? null : v);
const cents = (taka: number | null) => (taka === null ? null : taka * 100);

export async function saveStoreSection(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction("settings:write", storeSectionSchema, input, (d, actor) =>
    saveSection(actor.id, "store", {
      storeName: d.storeName,
      contactEmail: d.contactEmail,
      contactPhone: d.contactPhone,
      address: d.address,
      socialLinks: d.socialLinks,
    }),
  );
}

/** Free-shipping threshold + the zone list (replaced as a whole; ids kept for existing zones). */
export async function saveShippingSection(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction("settings:write", shippingSectionSchema, input, (d, actor) =>
    saveSection(actor.id, "shipping", { freeShippingThresholdCents: cents(d.freeShippingThreshold) }, async (tx) => {
      const existing = await tx.shippingZone.findMany({ orderBy: { sortOrder: "asc" } });
      const snap = (z: { name: string; rateCents: number; districts: string[]; etaText: string; isFallback: boolean }) => ({
        name: z.name,
        rateCents: z.rateCents,
        districts: z.districts,
        etaText: z.etaText,
        isFallback: z.isFallback,
      });
      const keep = new Set(d.zones.map((z) => z.id).filter(Boolean));
      await tx.shippingZone.deleteMany({ where: { id: { notIn: [...keep] as string[] } } });
      for (const [i, z] of d.zones.entries()) {
        const data = { name: z.name, rateCents: z.rate * 100, districts: z.isFallback ? [] : z.districts, etaText: z.etaText, isFallback: z.isFallback, sortOrder: i };
        if (z.id && existing.some((e) => e.id === z.id)) await tx.shippingZone.update({ where: { id: z.id }, data });
        else await tx.shippingZone.create({ data });
      }
      const before = existing.map(snap);
      const after = (await tx.shippingZone.findMany({ orderBy: { sortOrder: "asc" } })).map(snap);
      return JSON.stringify(before) === JSON.stringify(after) ? null : { before: { zones: before }, after: { zones: after } };
    }),
  );
}

export async function savePaymentsSection(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction("settings:write", paymentsSectionSchema, input, (d, actor) =>
    saveSection(actor.id, "payments", {
      bkashEnabled: d.bkashEnabled,
      sslcommerzEnabled: d.sslcommerzEnabled,
      codEnabled: d.codEnabled,
      codFeeCents: d.codFee * 100,
      codMaxOrderCents: cents(d.codMax),
      codAllowedDistricts: d.codAllowedDistricts,
      codMaxPerPhonePerDay: d.codMaxPerPhonePerDay,
      usdToBdtRate: d.usdToBdtRate,
    }),
  );
}

export async function saveCouriersSection(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction("settings:write", couriersSectionSchema, input, (d, actor) =>
    saveSection(actor.id, "couriers", {
      couriers: d.couriers.map((c) => c.name),
      courierTrackingUrls: Object.fromEntries(d.couriers.filter((c) => c.trackingUrl).map((c) => [c.name, c.trackingUrl])),
    }),
  );
}

export async function saveOrdersMediaSection(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction("settings:write", ordersMediaSectionSchema, input, (d, actor) =>
    saveSection(actor.id, "orders", {
      pendingPaymentTtlMin: d.pendingPaymentTtlMin,
      returnWindowDays: d.returnWindowDays,
      maxUploadMb: d.maxUploadMb,
      allowedUploadTypes: d.allowedUploadTypes,
    }),
  );
}

export async function saveSeoSection(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction("settings:write", seoSectionSchema, input, (d, actor) =>
    saveSection(actor.id, "seo", { seoTitleTemplate: d.seoTitleTemplate, seoDescription: d.seoDescription }),
  );
}

// ───────────────────────────── images (logo, favicon, OG) ─────────────────────────────

export async function getStoreImageUploadUrl(input: unknown): Promise<ActionResult<{ key: string; url: string; maxMb: number }>> {
  return runAdminAction("settings:write", uploadRequestSchema.pick({ mime: true, size: true }), input, ({ mime, size }) => presignTmpImage(mime, size));
}

const IMAGE_FIELD = { logo: "logoUrl", favicon: "faviconUrl", og: "ogImageUrl" } as const;

/** Upload done (key) → processed image stored, URL saved; key null → removed. */
export async function setStoreImage(input: unknown): Promise<ActionResult<{ url: string | null }>> {
  return runAdminAction("settings:write", storeImageSchema, input, async ({ purpose, key }, actor) => {
    const field = IMAGE_FIELD[purpose];
    const url = key ? await finalizeImage(key, purpose, actor.id) : null;
    const prev = (await prisma.settings.findUnique({ where: { id: ID }, select: { [field]: true } }))?.[field] as string | null | undefined;
    try {
      await saveSection(actor.id, purpose === "og" ? "seo" : "store", { [field]: url });
    } catch (err) {
      await deleteStoredImage(url);
      throw err instanceof ActionError ? err : new ActionError("Couldn't save the image. Please try again.");
    }
    if (prev && prev !== url) await deleteStoredImage(prev);
    return { url };
  });
}
