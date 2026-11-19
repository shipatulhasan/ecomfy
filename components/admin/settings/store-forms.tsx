"use client";

import { ImageIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { toast } from "sonner";
import { Field, fieldInput } from "@/components/admin/products/form/fields";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getStoreImageUploadUrl,
  saveCouriersSection,
  saveOrdersMediaSection,
  savePaymentsSection,
  saveSeoSection,
  saveShippingSection,
  saveStoreSection,
  setStoreImage,
} from "@/lib/actions/admin-settings";
import { SOCIAL_KEYS, type StoreSettings } from "@/lib/checkout/settings";
import { UPLOAD_ACCEPT, UPLOAD_MIME } from "@/lib/media/upload-rules";
import { cn } from "@/lib/utils";
import { DistrictPicker } from "./district-picker";
import { outlineButton, SectionActions, SectionError, SettingsCard, useSection } from "./section";
import { useImageUpload } from "./use-image-upload";

/**
 * Store settings tabs (derived; settings:write). Built only from the General Info
 * kit: SettingsCard, Add Products fields (48 high, muted), two columns from
 * tablet like "Profile Update", primary Save. Each card saves on its own.
 */

const input = cn(fieldInput, "h-12 text-lead");
const grid = "grid gap-6 tablet:grid-cols-2 tablet:gap-x-5";
const num = (v: string) => v;

function Prefixed({ prefix, children }: { prefix: string; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-lead text-text-body">
        {prefix}
      </span>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, badge }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void; badge?: React.ReactNode }) {
  return (
    <Label className="flex min-h-16 cursor-pointer items-center justify-between gap-4 rounded-lg border border-border px-4 py-3 font-normal">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-2 text-lead text-foreground">
          {label} {badge}
        </span>
        {hint && <span className="text-copy text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </Label>
  );
}

// ───────────────────────────── Store ─────────────────────────────

const SOCIAL_LABEL: Record<(typeof SOCIAL_KEYS)[number], string> = { facebook: "Facebook", twitter: "X (Twitter)", pinterest: "Pinterest", instagram: "Instagram" };

export function StoreForm({ settings }: { settings: StoreSettings }) {
  const st = settings.store;
  const s = useSection(
    {
      storeName: st.name,
      contactEmail: st.contactEmail,
      contactPhone: st.contactPhone,
      address: st.address,
      socialLinks: Object.fromEntries(SOCIAL_KEYS.map((k) => [k, st.socialLinks[k] ?? ""])) as Record<(typeof SOCIAL_KEYS)[number], string>,
    },
    saveStoreSection,
  );
  return (
    <div className="flex flex-col gap-5">
      <SettingsCard title="Store details" description="Shown in the storefront header and footer, on invoices and in emails.">
        <form onSubmit={s.submit} noValidate className="flex flex-col gap-6">
          <SectionError message={s.formError} />
          <div className={grid}>
            <Field id="st-name" label="Store name" error={s.err("storeName")}>
              <input id="st-name" value={s.values.storeName} onChange={(e) => s.set("storeName", e.target.value)} className={input} aria-invalid={!!s.err("storeName")} />
            </Field>
            <Field id="st-email" label="Contact email" error={s.err("contactEmail")}>
              <input id="st-email" type="email" value={s.values.contactEmail} onChange={(e) => s.set("contactEmail", e.target.value)} className={input} aria-invalid={!!s.err("contactEmail")} />
            </Field>
            <Field id="st-phone" label="Contact phone" hint="Landline or mobile, e.g. +880 2-58812345" error={s.err("contactPhone")}>
              <input id="st-phone" type="tel" value={s.values.contactPhone} onChange={(e) => s.set("contactPhone", e.target.value)} className={input} aria-invalid={!!s.err("contactPhone")} />
            </Field>
            <Field id="st-address" label="Store address" error={s.err("address")}>
              <input id="st-address" value={s.values.address} onChange={(e) => s.set("address", e.target.value)} className={input} aria-invalid={!!s.err("address")} />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-4 text-lead font-bold text-foreground">Social links</legend>
            <div className={grid}>
              {SOCIAL_KEYS.map((k) => (
                <Field key={k} id={`st-social-${k}`} label={SOCIAL_LABEL[k]} error={s.err(`socialLinks.${k}`)}>
                  <input
                    id={`st-social-${k}`}
                    type="url"
                    placeholder="https://"
                    value={s.values.socialLinks[k]}
                    onChange={(e) => s.set("socialLinks", { ...s.values.socialLinks, [k]: e.target.value })}
                    className={input}
                    aria-invalid={!!s.err(`socialLinks.${k}`)}
                  />
                </Field>
              ))}
            </div>
          </fieldset>
          <SectionActions dirty={s.dirty} pending={s.pending} onReset={s.reset} />
        </form>
      </SettingsCard>
      <SettingsCard title="Logo & favicon" description="Uploaded straight away. Without one, the built-in Ecofy logo and app icon are used.">
        <div className={grid}>
          <ImageSetting purpose="logo" label="Logo" hint="PNG or SVG-like artwork, wide. Shown up to 600 × 200." url={st.logoUrl} maxMb={settings.maxUploadMb} box="h-20 w-60" />
          <ImageSetting purpose="favicon" label="Favicon" hint="Square, at least 96 × 96." url={st.faviconUrl} maxMb={settings.maxUploadMb} box="size-20" />
        </div>
      </SettingsCard>
    </div>
  );
}

function ImageSetting({ purpose, label, hint, url, maxMb, box }: { purpose: "logo" | "favicon" | "og"; label: string; hint: string; url: string | null; maxMb: number; box: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const up = useImageUpload({
    maxMb,
    presign: getStoreImageUploadUrl,
    finalize: (key) => setStoreImage({ purpose, key }),
    onDone: (r) => {
      toast.success(r.url ? `${label} updated.` : `${label} removed.`);
      router.refresh();
    },
  });
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-lead font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap items-center gap-4">
        <div className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-muted", box)}>
          {url ? <Image src={url} alt={`Current ${label.toLowerCase()}`} fill sizes="15rem" className="object-contain p-1" /> : <ImageIcon aria-hidden className="size-6 text-muted-foreground" />}
        </div>
        <div className="flex flex-wrap gap-3">
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) up.upload(f);
              e.target.value = "";
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={up.pending} className={cn(outlineButton, up.pending && "animate-pulse")}>
            {up.pending ? "Uploading…" : url ? "Replace" : "Upload"}
          </button>
          {url && (
            <button type="button" onClick={up.remove} disabled={up.pending} className={cn(outlineButton, "text-destructive")}>
              Remove
            </button>
          )}
        </div>
      </div>
      <p className="text-caption text-muted-foreground">{hint}</p>
      {up.error && <p role="alert" className="text-caption text-destructive">{up.error}</p>}
    </div>
  );
}

// ───────────────────────────── Shipping ─────────────────────────────

type ZoneDraft = { id?: string; name: string; rate: string; districts: string[]; etaText: string; isFallback: boolean };

export function ShippingForm({ settings }: { settings: StoreSettings }) {
  const s = useSection(
    {
      freeShippingThreshold: settings.freeShippingThresholdCents === null ? "" : String(settings.freeShippingThresholdCents / 100),
      zones: settings.zones.map((z): ZoneDraft => ({ id: z.id === "default" ? undefined : z.id, name: z.name, rate: String(z.rateCents / 100), districts: z.districts, etaText: z.etaText, isFallback: z.isFallback })),
    },
    saveShippingSection,
  );
  const zones = s.values.zones;
  const setZone = (i: number, patch: Partial<ZoneDraft>) =>
    s.set(
      "zones",
      zones.map((z, j) => (j === i ? { ...z, ...patch } : patch.isFallback ? { ...z, isFallback: false } : z)),
    );
  const taken = (i: number) => zones.flatMap((z, j) => (j === i ? [] : z.districts));

  return (
    <SettingsCard title="Shipping" description="Checkout charges the zone of the delivery district. Changes apply to new checkouts right away.">
      <form onSubmit={s.submit} noValidate className="flex flex-col gap-6">
        <SectionError message={s.formError ?? s.err("zones") ?? null} />
        <Field id="sh-free" label="Free shipping from" hint="Cart total after discounts. Leave empty for no free shipping." error={s.err("freeShippingThreshold")} className="tablet:max-w-80">
          <Prefixed prefix="৳">
            <input
              id="sh-free"
              inputMode="numeric"
              placeholder="No free shipping"
              value={s.values.freeShippingThreshold}
              onChange={(e) => s.set("freeShippingThreshold", num(e.target.value))}
              className={cn(input, "pl-8")}
              aria-invalid={!!s.err("freeShippingThreshold")}
            />
          </Prefixed>
        </Field>
        <ul className="flex flex-col gap-4">
          {zones.map((z, i) => (
            <li key={z.id ?? `new-${i}`} className="flex flex-col gap-5 rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <p className="mr-auto text-lead font-bold text-foreground">Zone {i + 1}</p>
                <button
                  type="button"
                  onClick={() => s.set("zones", zones.filter((_, j) => j !== i))}
                  disabled={zones.length === 1}
                  aria-label={`Remove zone ${z.name || i + 1}`}
                  className="tap-target grid size-9 place-items-center rounded-md text-destructive hover:bg-sale-soft disabled:opacity-40"
                >
                  <Trash2Icon aria-hidden className="size-5" />
                </button>
              </div>
              <div className="grid gap-5 tablet:grid-cols-3 tablet:gap-x-5">
                <Field id={`z-${i}-name`} label="Name" error={s.err(`zones.${i}.name`)}>
                  <input id={`z-${i}-name`} value={z.name} placeholder="Inside Dhaka" onChange={(e) => setZone(i, { name: e.target.value })} className={input} />
                </Field>
                <Field id={`z-${i}-rate`} label="Rate" error={s.err(`zones.${i}.rate`)}>
                  <Prefixed prefix="৳">
                    <input id={`z-${i}-rate`} inputMode="numeric" value={z.rate} onChange={(e) => setZone(i, { rate: e.target.value })} className={cn(input, "pl-8")} />
                  </Prefixed>
                </Field>
                <Field id={`z-${i}-eta`} label="Delivery estimate" error={s.err(`zones.${i}.etaText`)}>
                  <input id={`z-${i}-eta`} value={z.etaText} placeholder="1–2 days" onChange={(e) => setZone(i, { etaText: e.target.value })} className={input} />
                </Field>
              </div>
              <Label className="tap-target flex items-center gap-2 text-copy font-normal text-foreground">
                <Checkbox checked={z.isFallback} onCheckedChange={(v) => setZone(i, { isFallback: v === true })} />
                Covers all other districts
              </Label>
              {!z.isFallback && (
                <Field id={`z-${i}-districts`} label="Districts" error={s.err(`zones.${i}.districts`)}>
                  <DistrictPicker id={`z-${i}-districts`} value={z.districts} onChange={(d) => setZone(i, { districts: d })} disabledOptions={taken(i)} invalid={!!s.err(`zones.${i}.districts`)} />
                </Field>
              )}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => s.set("zones", [...zones, { name: "", rate: "0", districts: [], etaText: "", isFallback: false }])}
          disabled={zones.length >= 20}
          className={cn(outlineButton, "self-start")}
        >
          <PlusIcon aria-hidden className="size-5" /> Add zone
        </button>
        <SectionActions dirty={s.dirty} pending={s.pending} onReset={s.reset} />
      </form>
    </SettingsCard>
  );
}

// ───────────────────────────── Payments ─────────────────────────────

export type GatewayModes = { bkash: "sandbox" | "live" | "missing"; sslcommerz: "sandbox" | "live" | "missing" };

function ModeBadge({ mode }: { mode: GatewayModes["bkash"] }) {
  const [label, cls] =
    mode === "live" ? ["Live", "bg-success-soft text-primary"] : mode === "sandbox" ? ["Sandbox", "bg-warning-soft text-warning-strong"] : ["Not configured", "bg-sale-soft text-destructive"];
  return <span className={cn("rounded-full px-2.5 py-0.5 text-caption font-bold", cls)}>{label}</span>;
}

export function PaymentsForm({ settings, modes }: { settings: StoreSettings; modes: GatewayModes }) {
  const s = useSection(
    {
      bkashEnabled: settings.bkashEnabled,
      sslcommerzEnabled: settings.sslcommerzEnabled,
      codEnabled: settings.codEnabled,
      codFee: String(settings.codFeeCents / 100),
      codMax: settings.codMaxOrderCents === null ? "" : String(settings.codMaxOrderCents / 100),
      codAllowedDistricts: settings.codAllowedDistricts,
      codMaxPerPhonePerDay: String(settings.codMaxPerPhonePerDay),
      usdToBdtRate: String(settings.usdToBdtRate),
    },
    savePaymentsSection,
  );
  const v = s.values;
  return (
    <SettingsCard title="Payments" description="Methods customers can choose at checkout. Gateway keys and live/sandbox mode come from the server environment and can't be changed here.">
      <form onSubmit={s.submit} noValidate className="flex flex-col gap-6">
        <SectionError message={s.formError} />
        <div className="grid gap-3 laptop:grid-cols-3">
          <ToggleRow label="bKash" badge={<ModeBadge mode={modes.bkash} />} checked={v.bkashEnabled} onChange={(x) => s.set("bkashEnabled", x)} />
          <ToggleRow label="SSLCommerz" hint="Cards & online banking" badge={<ModeBadge mode={modes.sslcommerz} />} checked={v.sslcommerzEnabled} onChange={(x) => s.set("sslcommerzEnabled", x)} />
          <ToggleRow label="Cash on delivery" checked={v.codEnabled} onChange={(x) => s.set("codEnabled", x)} />
        </div>
        <fieldset disabled={!v.codEnabled} className="flex flex-col gap-4 disabled:opacity-60">
          <legend className="mb-4 text-lead font-bold text-foreground">Cash on delivery rules</legend>
          <div className="grid gap-6 tablet:grid-cols-3 tablet:gap-x-5">
            <Field id="pay-codfee" label="COD fee" error={s.err("codFee")}>
              <Prefixed prefix="৳">
                <input id="pay-codfee" inputMode="numeric" value={v.codFee} onChange={(e) => s.set("codFee", e.target.value)} className={cn(input, "pl-8")} />
              </Prefixed>
            </Field>
            <Field id="pay-codmax" label="Max order for COD" hint="Empty = no limit" error={s.err("codMax")}>
              <Prefixed prefix="৳">
                <input id="pay-codmax" inputMode="numeric" placeholder="No limit" value={v.codMax} onChange={(e) => s.set("codMax", e.target.value)} className={cn(input, "pl-8")} />
              </Prefixed>
            </Field>
            <Field id="pay-codphone" label="COD orders per phone per day" error={s.err("codMaxPerPhonePerDay")}>
              <input id="pay-codphone" inputMode="numeric" value={v.codMaxPerPhonePerDay} onChange={(e) => s.set("codMaxPerPhonePerDay", e.target.value)} className={input} />
            </Field>
          </div>
          <Field id="pay-coddistricts" label="COD allowed in" hint="No districts chosen = every district." error={s.err("codAllowedDistricts")}>
            <DistrictPicker id="pay-coddistricts" value={v.codAllowedDistricts} onChange={(d) => s.set("codAllowedDistricts", d)} placeholder="Every district" />
          </Field>
        </fieldset>
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 text-lead font-bold text-foreground">Currency</legend>
          <Field id="pay-usd" label="USD → BDT rate" hint="Prices are charged in BDT; the storefront's USD switcher shows BDT ÷ this rate." error={s.err("usdToBdtRate")} className="tablet:max-w-80">
            <Prefixed prefix="1 $ = ৳">
              <input id="pay-usd" inputMode="decimal" value={v.usdToBdtRate} onChange={(e) => s.set("usdToBdtRate", e.target.value)} className={cn(input, "pl-24")} />
            </Prefixed>
          </Field>
        </fieldset>
        <SectionActions dirty={s.dirty} pending={s.pending} onReset={s.reset} />
      </form>
    </SettingsCard>
  );
}

// ───────────────────────────── Couriers ─────────────────────────────

export function CouriersForm({ settings }: { settings: StoreSettings }) {
  const s = useSection({ couriers: settings.couriers.map((name) => ({ name, trackingUrl: settings.courierTrackingUrls[name] ?? "" })) }, saveCouriersSection);
  const list = s.values.couriers;
  const setAt = (i: number, patch: Partial<(typeof list)[number]>) => s.set("couriers", list.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <SettingsCard title="Couriers" description="Choices in “Mark shipped”. With a tracking link template, the order and the customer email link straight to tracking.">
      <form onSubmit={s.submit} noValidate className="flex flex-col gap-5">
        <SectionError message={s.formError ?? s.err("couriers") ?? null} />
        <ul className="flex flex-col gap-4">
          {list.map((c, i) => (
            <li key={i} className="grid items-start gap-3 rounded-lg border border-border p-4 tablet:grid-cols-[14rem_minmax(0,1fr)_auto] tablet:gap-5">
              <Field id={`c-${i}-name`} label="Courier" error={s.err(`couriers.${i}.name`)}>
                <input id={`c-${i}-name`} value={c.name} placeholder="Pathao" onChange={(e) => setAt(i, { name: e.target.value })} className={input} />
              </Field>
              <Field id={`c-${i}-url`} label="Tracking link template" hint="Optional. {tracking} is replaced by the tracking number." error={s.err(`couriers.${i}.trackingUrl`)}>
                <input id={`c-${i}-url`} type="url" value={c.trackingUrl} placeholder="https://courier.example/track/{tracking}" onChange={(e) => setAt(i, { trackingUrl: e.target.value })} className={input} />
              </Field>
              <button
                type="button"
                onClick={() => s.set("couriers", list.filter((_, j) => j !== i))}
                disabled={list.length === 1}
                aria-label={`Remove ${c.name || "courier"}`}
                className="tap-target grid size-9 place-items-center self-end rounded-md text-destructive hover:bg-sale-soft disabled:opacity-40 tablet:mb-1.5"
              >
                <Trash2Icon aria-hidden className="size-5" />
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => s.set("couriers", [...list, { name: "", trackingUrl: "" }])} disabled={list.length >= 20} className={cn(outlineButton, "self-start")}>
          <PlusIcon aria-hidden className="size-5" /> Add courier
        </button>
        <SectionActions dirty={s.dirty} pending={s.pending} onReset={s.reset} />
      </form>
    </SettingsCard>
  );
}

// ───────────────────────────── Orders & Media ─────────────────────────────

const MIME_LABEL: Record<keyof typeof UPLOAD_MIME, string> = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP", "image/avif": "AVIF" };

export function OrdersMediaForm({ settings }: { settings: StoreSettings }) {
  const s = useSection(
    {
      pendingPaymentTtlMin: String(settings.pendingPaymentTtlMin),
      returnWindowDays: String(settings.returnWindowDays),
      maxUploadMb: String(settings.maxUploadMb),
      allowedUploadTypes: settings.allowedUploadTypes,
    },
    saveOrdersMediaSection,
  );
  const v = s.values;
  return (
    <SettingsCard title="Orders & media">
      <form onSubmit={s.submit} noValidate className="flex flex-col gap-6">
        <SectionError message={s.formError} />
        <div className={grid}>
          <Field id="om-ttl" label="Unpaid order expiry (minutes)" hint="bKash / card orders not paid in time are cancelled and their stock released." error={s.err("pendingPaymentTtlMin")}>
            <input id="om-ttl" inputMode="numeric" value={v.pendingPaymentTtlMin} onChange={(e) => s.set("pendingPaymentTtlMin", e.target.value)} className={input} />
          </Field>
          <Field id="om-return" label="Return window (days)" hint="How long after delivery an order can be marked returned." error={s.err("returnWindowDays")}>
            <input id="om-return" inputMode="numeric" value={v.returnWindowDays} onChange={(e) => s.set("returnWindowDays", e.target.value)} className={input} />
          </Field>
          <Field id="om-mb" label="Max image upload (MB)" error={s.err("maxUploadMb")}>
            <input id="om-mb" inputMode="numeric" value={v.maxUploadMb} onChange={(e) => s.set("maxUploadMb", e.target.value)} className={input} />
          </Field>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-lead font-medium text-foreground">Allowed image types</legend>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {(Object.keys(UPLOAD_MIME) as (keyof typeof UPLOAD_MIME)[]).map((m) => (
                <Label key={m} className="tap-target gap-2 text-copy font-normal text-foreground">
                  <Checkbox
                    checked={v.allowedUploadTypes.includes(m)}
                    onCheckedChange={(on) => s.set("allowedUploadTypes", on === true ? [...v.allowedUploadTypes, m] : v.allowedUploadTypes.filter((x) => x !== m))}
                  />
                  {MIME_LABEL[m]}
                </Label>
              ))}
            </div>
            {s.err("allowedUploadTypes") && <p className="text-caption text-destructive">{s.err("allowedUploadTypes")}</p>}
          </fieldset>
        </div>
        <SectionActions dirty={s.dirty} pending={s.pending} onReset={s.reset} />
      </form>
    </SettingsCard>
  );
}

// ───────────────────────────── SEO ─────────────────────────────

export function SeoForm({ settings }: { settings: StoreSettings }) {
  const s = useSection({ seoTitleTemplate: settings.seo.titleTemplate, seoDescription: settings.seo.description }, saveSeoSection);
  const v = s.values;
  const preview = v.seoTitleTemplate.replace("%s", "Fresh Fruit");
  return (
    <div className="flex flex-col gap-5">
      <SettingsCard title="SEO defaults" description="Used by pages that don't set their own title or description.">
        <form onSubmit={s.submit} noValidate className="flex flex-col gap-6">
          <SectionError message={s.formError} />
          <Field id="seo-title" label="Title template" hint="%s is the page title." error={s.err("seoTitleTemplate")}>
            <input id="seo-title" value={v.seoTitleTemplate} onChange={(e) => s.set("seoTitleTemplate", e.target.value)} className={input} aria-invalid={!!s.err("seoTitleTemplate")} />
          </Field>
          <Field id="seo-desc" label="Meta description" hint={`${v.seoDescription.length}/160`} error={s.err("seoDescription")}>
            <textarea
              id="seo-desc"
              value={v.seoDescription}
              maxLength={200}
              onChange={(e) => s.set("seoDescription", e.target.value)}
              className={cn(fieldInput, "h-29.25 resize-none py-3.5 text-lead")}
              aria-invalid={!!s.err("seoDescription")}
            />
          </Field>
          <div className="rounded-lg border border-border p-4">
            <p className="text-caption text-muted-foreground">Search preview</p>
            <p className="truncate text-lead text-info">{preview}</p>
            <p className="line-clamp-2 text-copy text-text-body">{v.seoDescription}</p>
          </div>
          <SectionActions dirty={s.dirty} pending={s.pending} onReset={s.reset} />
        </form>
      </SettingsCard>
      <SettingsCard title="Social share image" description="Shown when a page is shared (1200 × 630). Uploaded straight away.">
        <ImageSetting purpose="og" label="Share image" hint="Cropped to 1200 × 630." url={settings.seo.ogImageUrl} maxMb={settings.maxUploadMb} box="h-31.5 w-60" />
      </SettingsCard>
    </div>
  );
}
