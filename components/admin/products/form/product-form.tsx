"use client";

import { useUnsavedChangesGuard } from "@/components/shared/use-unsaved-guard";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDownIcon, CirclePlusIcon, ExternalLinkIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, FormProvider, useForm, useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { checkSlug, saveProduct } from "@/lib/actions/admin-products";
import type { MediaItem } from "@/lib/admin/media";
import { slugify, stockLevel } from "@/lib/admin/products/rules";
import { formatPrice } from "@/lib/money";
import { productFormSchema, type ProductFormData, type ProductFormValues } from "@/lib/validations/admin-product";
import { cn } from "@/lib/utils";
import { DateField } from "./date-field";
import { Field, FieldError, fieldInput, FormCard } from "./fields";
import { CategoryPicker, CreatableSelect, dropdownClass } from "./pickers";
import { ProductImages } from "./product-images";
import { ProductSearch } from "./product-search";
import { RichTextEditor } from "./rich-text-editor";
import { COLOR_SWATCHES, NumberField, syncVariants, VariantsSection } from "./variants";

type Category = { id: string; name: string };
type Status = ProductFormValues["status"];

/**
 * Add / Edit Product (designs/screens/admin/Add Products.png). One form for
 * both: react-hook-form + the shared zod schema (re-validated by saveProduct).
 * Laptop+: Basic Details | Upload Product Image, as in the PNG. Below laptop:
 * one column, images first.
 *
 * Save to draft / Publish Product (header and footer), Cmd/Ctrl+S saves with the
 * current status. Leaving with unsaved changes asks first.
 */
export function ProductForm({
  initial,
  initialMedia,
  categories: initialCategories,
  brands,
  tags,
  maxMb,
  canWrite,
  canAddCategory,
}: {
  initial: ProductFormValues;
  initialMedia: Record<string, MediaItem>;
  categories: Category[];
  brands: string[];
  tags: string[];
  maxMb: number;
  canWrite: boolean;
  canAddCategory: boolean;
}) {
  const router = useRouter();
  const isNew = !initial.id;
  const form = useForm<ProductFormValues, unknown, ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initial,
    mode: "onTouched",
  });
  const { register, control, formState, setValue, getValues, setError } = form;
  const errors = formState.errors;
  const [media, setMedia] = useState(initialMedia);
  const [categories, setCategories] = useState(initialCategories);
  const [saving, startSaving] = useTransition();
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const savedStatus = useRef<Status>(initial.status);

  const name = useWatch({ control, name: "name" });
  const slugValue = useWatch({ control, name: "slug" });
  const track = useWatch({ control, name: "trackInventory" });
  const options = useWatch({ control, name: "options" });
  const variants = useWatch({ control, name: "variants" });
  const multi = options.length > 0;
  const first = variants[0];

  // Slug follows the name until edited by hand.
  useEffect(() => {
    // Revalidate after a failed submit so a stale "Required" clears as the slug fills in.
    if (!slugTouched) setValue("slug", slugify(name ?? ""), { shouldDirty: true, shouldValidate: formState.isSubmitted });
  }, [name, slugTouched, setValue, formState.isSubmitted]);

  // ── save ──
  const submit = (status: Status) => {
    if (!canWrite || saving) return;
    setValue("status", status, { shouldDirty: true });
    void form.handleSubmit(
      (data) =>
        startSaving(async () => {
          const res = await saveProduct(data);
          if (!res.ok) {
            const fields = Object.entries(res.fieldErrors ?? {}).filter(([, m]) => m?.length);
            for (const [key, messages] of fields) setError(key as FieldPath<ProductFormValues>, { type: "server", message: messages![0] });
            toast.error(res.error);
            if (fields.length) scrollToFirstError();
            return;
          }
          savedStatus.current = res.data.status as Status;
          // New baseline: the saved values are the clean state.
          form.reset({ ...getValues(), id: res.data.id, slug: res.data.slug, status: res.data.status as Status });
          const live = res.data.status === "PUBLISHED";
          toast.success(live ? "Saved and published" : "Saved as draft", {
            description: live ? undefined : "Not on the store until you publish it.",
            action: live ? { label: "View on store", onClick: () => window.open(`/product/${res.data.slug}`, "_blank", "noopener") } : undefined,
          });
          if (isNew) router.replace(`/admin/products/${res.data.id}`);
          else router.refresh();
        }),
      () => {
        toast.error("Please fix the highlighted fields.");
        scrollToFirstError();
      },
    )();
  };

  // Cmd/Ctrl+S: save, keeping the current status (drafts stay drafts).
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        submitRef.current(savedStatus.current === "ARCHIVED" ? "ARCHIVED" : isNew ? "DRAFT" : savedStatus.current);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNew]);

  // Unsaved-changes guard: tab close / reload, and in-app links (capture phase runs before next/link).
  const dirty = formState.isDirty && !saving && canWrite;
  useUnsavedChangesGuard(dirty);

  const onSlugBlur = async () => {
    if (!canWrite || !(await form.trigger("slug"))) return; // fresh format check, not a stale error
    const slug = getValues("slug");
    const res = await checkSlug({ slug, excludeId: initial.id });
    if (res.ok && !res.data.available) setError("slug", { type: "server", message: `Already used. Try “${res.data.suggestion}”.` });
  };

  const toggleColor = (color: string) => {
    const opts = getValues("options");
    const existing = opts.find((o) => o.name === "Color");
    let next: ProductFormValues["options"];
    if (!existing) next = [...opts, { name: "Color", values: [color] }];
    else {
      const values = existing.values.includes(color) ? existing.values.filter((v) => v !== color) : [...existing.values, color];
      next = values.length ? opts.map((o) => (o.name === "Color" ? { ...o, values } : o)) : opts.filter((o) => o.name !== "Color");
    }
    setValue("options", next, { shouldDirty: true });
    setValue("variants", syncVariants(next, getValues("variants"), getValues("sku")), { shouldDirty: true });
  };
  const colors = options.find((o) => o.name === "Color")?.values ?? [];

  const salePrice = first && first.discount ? Math.max(0, first.price - first.discount) : null;
  const totalStock = variants.reduce((n, v) => n + (Number.isFinite(v.stock) ? v.stock : 0), 0);
  const level = stockLevel({ stock: totalStock, trackInventory: true, lowStockThreshold: Number(getValues("lowStockThreshold")) || 0 });
  const disabled = !canWrite;

  const actions = (where: "header" | "footer") => (
    <>
      <button
        type="button"
        disabled={disabled || saving}
        onClick={() => submit("DRAFT")}
        className={cn(
          "press inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card font-medium text-foreground shadow-sm transition-colors hover:bg-muted disabled:opacity-50",
          where === "header" ? "h-12 px-4 text-lead" : "h-10 px-2 text-lead",
        )}
      >
        <SaveIcon aria-hidden className="size-4" /> Save to draft
      </button>
      <button
        type="button"
        disabled={disabled || saving}
        onClick={() => submit("PUBLISHED")}
        className={cn(
          "press inline-flex items-center justify-center rounded-lg bg-primary font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50",
          where === "header" ? "h-12 px-4 text-lead" : "h-10 px-3 text-lead",
        )}
      >
        {saving ? "Saving…" : initial.status === "PUBLISHED" && !isNew ? "Update Product" : "Publish Product"}
      </button>
    </>
  );

  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit(savedStatus.current);
        }}
        aria-busy={saving}
        className="flex flex-col gap-6"
      >
        {/* Header row: title | search · Publish · Save to draft · ⊕ */}
        <div className="flex flex-col gap-4 laptop:flex-row laptop:items-center laptop:justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-h1 text-foreground">{isNew ? "Add New Product" : "Edit Product"}</h2>
            {!isNew && initial.status !== "DRAFT" && (
              <a href={`/product/${initial.slug}`} target="_blank" rel="noreferrer" className="tap-target inline-flex items-center gap-1 text-copy text-primary hover:underline">
                View on store <ExternalLinkIcon aria-hidden className="size-3.5" />
              </a>
            )}
          </div>
          <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center">
            <div className="w-full tablet:w-auto tablet:min-w-0 tablet:flex-1 laptop:w-79 laptop:flex-none">
              <ProductSearch />
            </div>
            {canWrite && (
              <div className="hidden items-center gap-3 tablet:flex [&>button]:min-w-35">
                {actions("header")}
                <Link
                  href="/admin/products/new"
                  aria-label="New blank product"
                  title="New blank product"
                  className="tap-target grid size-12 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground hover:bg-muted"
                >
                  <CirclePlusIcon aria-hidden className="size-6 stroke-[1.5]" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {!canWrite && (
          <p role="status" className="rounded-lg bg-info-soft px-4 py-3 text-copy text-info-strong">
            View only: your role can see products but not change them.
          </p>
        )}

        <fieldset disabled={disabled} className="grid min-w-0 gap-5 laptop:grid-cols-[634fr_485fr] laptop:items-start">
          {/* ── Left: Basic Details, Pricing, Inventory, Variants, Additional info, SEO ── */}
          <FormCard aria-labelledby="basic-title" className="order-2 flex flex-col gap-8 laptop:order-1">
            <div className="flex flex-col gap-6">
              <h3 id="basic-title" className="text-h1 text-foreground laptop:px-2.75">
                Basic Details
              </h3>
              <Field id="name" label="Product Name" error={errors.name?.message}>
                <input id="name" {...register("name")} aria-invalid={!!errors.name} aria-describedby="name-error" className={fieldInput} placeholder="e.g. Chinese Cabbage" />
              </Field>
              <div className="grid gap-6 tablet:grid-cols-2">
                <Field id="slug" label="URL slug" hint={`/product/${slugValue || "…"}`} error={errors.slug?.message}>
                  <input
                    id="slug"
                    {...register("slug", {
                      onChange: () => setSlugTouched(true),
                      onBlur: onSlugBlur,
                      setValueAs: (v: string) => v.trim().toLowerCase(),
                    })}
                    aria-invalid={!!errors.slug}
                    aria-describedby="slug-error"
                    className={fieldInput}
                    spellCheck={false}
                  />
                </Field>
                <Field id="sku" label="SKU" error={errors.sku?.message}>
                  <input id="sku" {...register("sku")} aria-invalid={!!errors.sku} aria-describedby="sku-error" className={fieldInput} spellCheck={false} />
                </Field>
              </div>
              <div className="flex flex-col gap-3">
                <span id="description-label" className="text-lead font-medium text-foreground">
                  Product Description
                </span>
                <Controller
                  control={control}
                  name="description"
                  render={({ field, fieldState }) => (
                    <RichTextEditor
                      id="description"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={!!fieldState.error}
                      describedBy="description-error"
                      disabled={disabled}
                    />
                  )}
                />
                <FieldError id="description-error" message={errors.description?.message} />
              </div>
              <Field id="shortDescription" label="Short summary (optional)" hint="Shown under the price on the product page." error={errors.shortDescription?.message}>
                <textarea id="shortDescription" {...register("shortDescription")} rows={2} maxLength={300} className={cn(fieldInput, "h-auto py-3")} />
              </Field>
            </div>

            {/* Pricing */}
            <div className="flex flex-col gap-6">
              <h3 className="text-h1 text-foreground">Pricing</h3>
              <Field
                id="price"
                label={multi ? "Product Price (default variant)" : "Product Price"}
                error={errors.variants?.[0]?.price?.message}
              >
                <div className="relative">
                  <NumberField
                    name="variants.0.price"
                    id="price"
                    step="0.01"
                    min={0}
                    inputMode="decimal"
                    aria-describedby="price-error"
                    className={cn(fieldInput, "pr-28")}
                  />
                  <span
                    title="Store currency"
                    className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5 border-l border-border pl-3 text-copy font-bold text-foreground"
                  >
                    ৳ BDT
                    <ChevronDownIcon aria-hidden className="size-4 fill-foreground text-foreground opacity-40" />
                  </span>
                </div>
              </Field>
              <div className="grid gap-6 tablet:grid-cols-2">
                <Field id="discount" label={<>Discounted Price <span className="font-normal text-muted-foreground">(Optional)</span></>} error={errors.variants?.[0]?.discount?.message}>
                  <div className="relative">
                    <span aria-hidden className="absolute top-1/2 left-3 grid size-8 -translate-y-1/2 place-items-center rounded-md bg-secondary text-lead font-bold text-foreground">
                      ৳
                    </span>
                    <NumberField
                      name="variants.0.discount"
                      nullable
                      id="discount"
                      step="0.01"
                      min={0}
                      inputMode="decimal"
                      placeholder="0"
                      aria-describedby="discount-error discount-sale"
                      className={cn(fieldInput, "pr-32 pl-14")}
                    />
                    {salePrice !== null && (
                      <span id="discount-sale" className="absolute top-1/2 right-3 -translate-y-1/2 text-lead font-medium text-foreground">
                        Sale= {formatPrice(Math.round(salePrice * 100))}
                      </span>
                    )}
                  </div>
                </Field>
                <div className="flex flex-col gap-3">
                  <span id="tax-label" className="text-lead font-medium text-foreground">
                    Tax Included
                  </span>
                  <Controller
                    control={control}
                    name="taxIncluded"
                    render={({ field }) => (
                      <RadioGroup aria-labelledby="tax-label" value={field.value ? "yes" : "no"} onValueChange={(v) => field.onChange(v === "yes")} className="gap-2.5">
                        {(["yes", "no"] as const).map((v) => (
                          <label key={v} className="flex min-h-5 items-center gap-1 text-lead text-foreground">
                            <RadioGroupItem value={v} className="size-4" /> {v === "yes" ? "Yes" : "No"}
                          </label>
                        ))}
                      </RadioGroup>
                    )}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-lead font-medium text-foreground">Expiration</span>
                <div className="grid gap-5 tablet:grid-cols-2">
                  <Controller
                    control={control}
                    name="saleStartsAt"
                    render={({ field }) => <DateField id="saleStartsAt" edge="start" placeholder="Start" value={field.value} onChange={field.onChange} disabled={disabled} />}
                  />
                  <Controller
                    control={control}
                    name="saleEndsAt"
                    render={({ field, fieldState }) => (
                      <DateField id="saleEndsAt" edge="end" placeholder="End" value={field.value} onChange={field.onChange} invalid={!!fieldState.error} disabled={disabled} />
                    )}
                  />
                </div>
                <p className="text-caption text-muted-foreground">The discount applies between these days (Asia/Dhaka). The end date also drives the Hot Deals countdown.</p>
                <FieldError message={errors.saleEndsAt?.message} />
              </div>
            </div>

            {/* Inventory */}
            <div className="flex flex-col gap-5">
              <h3 className="text-h1 text-foreground">Inventory</h3>
              <div className="grid gap-5 tablet:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <Field id="stock" label="Stock Quantity" error={errors.variants?.[0]?.stock?.message}>
                    {!track ? (
                      <input key="unlimited" id="stock" value="Unlimited" readOnly className={cn(fieldInput, "bg-card")} />
                    ) : multi ? (
                      <input key="total" id="stock" value={`${totalStock.toLocaleString("en-US")} (set per variant)`} readOnly className={cn(fieldInput, "bg-card")} />
                    ) : (
                      <NumberField
                        key="single"
                        name="variants.0.stock"
                        id="stock"
                        min={0}
                        inputMode="numeric"
                        aria-describedby="stock-error"
                        className={cn(fieldInput, "bg-card")}
                      />
                    )}
                  </Field>
                  <Controller
                    control={control}
                    name="trackInventory"
                    render={({ field }) => (
                      <label className="flex min-h-6 items-center gap-3 text-lead text-foreground">
                        <Switch checked={!field.value} onCheckedChange={(on) => field.onChange(!on)} className="h-6 w-12" />
                        Unlimited
                      </label>
                    )}
                  />
                </div>
                <Field id="stockStatus" label="Stock Status">
                  {track ? (
                    <input
                      key="derived"
                      id="stockStatus"
                      readOnly
                      value={level === "out" ? "Out of Stock" : level === "low" ? "Low Stock" : "In Stock"}
                      className={cn(fieldInput, "bg-card")}
                      aria-describedby="stockStatus-hint"
                    />
                  ) : (
                    <Controller
                      control={control}
                      name="stockStatus"
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                          <SelectTrigger id="stockStatus" className={cn(dropdownClass, "bg-card shadow-none data-[size=default]:h-12")}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper">
                            <SelectItem value="IN_STOCK">In Stock</SelectItem>
                            <SelectItem value="OUT_OF_STOCK">Out of Stock</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                </Field>
              </div>
              {track && (
                <Field id="lowStockThreshold" label="Low stock alert at" className="tablet:w-1/2 tablet:pr-2.5" error={errors.lowStockThreshold?.message}>
                  <input id="lowStockThreshold" type="number" min={0} inputMode="numeric" {...register("lowStockThreshold", { valueAsNumber: true })} className={cn(fieldInput, "bg-card")} />
                </Field>
              )}
              <Controller
                control={control}
                name="isFeatured"
                render={({ field }) => (
                  <label className="flex min-h-5 items-center gap-2 text-lead text-text-body">
                    <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} className="size-5" />
                    Highlight this product in a featured section.
                  </label>
                )}
              />
            </div>

            <VariantsSection disabled={disabled} />
            <AttributesSection disabled={disabled} />
            <SeoSection />

            {canWrite && <div className="flex flex-wrap justify-end gap-3">{actions("footer")}</div>}
          </FormCard>

          {/* ── Right: images, categories, tags, brand, colors ── */}
          <FormCard aria-labelledby="images-title" className="order-1 flex flex-col gap-8 laptop:order-2">
            <div className="flex flex-col gap-5">
              <h3 id="images-title" className="text-h1 text-foreground">
                Upload Product Image
              </h3>
              <Controller
                control={control}
                name="images"
                render={({ field }) => (
                  <ProductImages
                    images={field.value}
                    media={media}
                    variants={multi ? variants.map((v) => ({ key: v.key, name: v.name })) : []}
                    maxMb={maxMb}
                    disabled={disabled}
                    onChange={field.onChange}
                    onMedia={(items) => setMedia((m) => ({ ...m, ...Object.fromEntries(items.map((i) => [i.id, i])) }))}
                  />
                )}
              />
              <FieldError message={errors.images?.message ?? errors.images?.root?.message} />
            </div>

            <div className="flex flex-col gap-5">
              <h3 className="text-h1 text-foreground">Categories</h3>
              <Field id="categoryId" label="Product Categories" error={errors.categoryId?.message}>
                <Controller
                  control={control}
                  name="categoryId"
                  render={({ field, fieldState }) => (
                    <CategoryPicker
                      id="categoryId"
                      value={field.value}
                      onChange={field.onChange}
                      categories={categories}
                      onCategoryAdded={(c) => setCategories((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, c]))}
                      canAdd={canAddCategory}
                      invalid={!!fieldState.error}
                      describedBy="categoryId-error"
                      disabled={disabled}
                    />
                  )}
                />
              </Field>
              <Field id="tags" label="Product Tag" error={errors.tags?.message}>
                <Controller
                  control={control}
                  name="tags"
                  render={({ field }) => (
                    <CreatableSelect id="tags" multiple value={field.value} onChange={field.onChange} options={tags} placeholder="Select your product" noun="tag" disabled={disabled} />
                  )}
                />
              </Field>
              <Field id="brand" label="Brand" error={errors.brand?.message}>
                <Controller
                  control={control}
                  name="brand"
                  render={({ field }) => (
                    <CreatableSelect
                      id="brand"
                      value={field.value ? [field.value] : []}
                      onChange={(v) => field.onChange(v[0] ?? "")}
                      options={brands}
                      placeholder="Select a brand"
                      noun="brand"
                      disabled={disabled}
                    />
                  )}
                />
              </Field>
              <div className="flex flex-col gap-3">
                <span id="colors-label" className="text-lead font-medium text-foreground">
                  Select your color
                </span>
                <ul aria-labelledby="colors-label" className="flex flex-wrap gap-3">
                  {COLOR_SWATCHES.map((s) => {
                    const on = colors.includes(s.name);
                    return (
                      <li key={s.name}>
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={s.name}
                          title={s.name}
                          disabled={disabled}
                          onClick={() => toggleColor(s.name)}
                          className={cn(
                            "press size-12 rounded-lg outline-none transition-shadow focus-visible:ring-3 focus-visible:ring-ring/40",
                            s.className,
                            on ? "ring-3 ring-primary ring-offset-2 ring-offset-card" : "shadow-sm",
                          )}
                        />
                      </li>
                    );
                  })}
                </ul>
                <p className="text-caption text-muted-foreground">Each color becomes a variant (see Variants).</p>
              </div>
            </div>
          </FormCard>
        </fieldset>

        {/* Mobile/tablet: actions pinned at the bottom of the screen. */}
        {canWrite && (
          <div className="sticky bottom-0 z-20 -mx-4 flex gap-3 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] tablet:hidden [&>button]:h-11 [&>button]:flex-1">
            {actions("footer")}
          </div>
        )}
      </form>
    </FormProvider>
  );
}

function scrollToFirstError() {
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"], [role="alert"]');
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (el.matches("input, textarea, button, [contenteditable]")) el.focus({ preventScroll: true });
  });
}

/** PDP "Additional Information" rows (not in the PNG). */
function AttributesSection({ disabled }: { disabled?: boolean }) {
  const { register, control, setValue, getValues, formState } = useFormContextTyped();
  const rows = useWatch({ control, name: "attributes" });
  const set = (next: ProductFormValues["attributes"]) => setValue("attributes", next, { shouldDirty: true });
  return (
    <section aria-labelledby="attributes-title" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id="attributes-title" className="text-h3 text-foreground">
          Additional information
        </h3>
        {!disabled && (
          <button type="button" onClick={() => set([...getValues("attributes"), { name: "", value: "" }])} className="tap-target text-copy font-medium text-primary hover:underline">
            + Add row
          </button>
        )}
      </div>
      <p className="-mt-2 text-caption text-muted-foreground">Rows for the product page’s “Additional Information” tab (e.g. Weight, Type). Category, stock and tags are added automatically.</p>
      {rows.map((_, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] items-start gap-2">
          <div>
            <input aria-label={`Row ${i + 1} name`} placeholder="Name" {...register(`attributes.${i}.name`)} aria-invalid={!!formState.errors.attributes?.[i]?.name} className={cn(fieldInput, "h-10")} />
            <FieldError message={formState.errors.attributes?.[i]?.name?.message} />
          </div>
          <div>
            <input aria-label={`Row ${i + 1} value`} placeholder="Value" {...register(`attributes.${i}.value`)} aria-invalid={!!formState.errors.attributes?.[i]?.value} className={cn(fieldInput, "h-10")} />
            <FieldError message={formState.errors.attributes?.[i]?.value?.message} />
          </div>
          {!disabled && (
            <button type="button" aria-label={`Remove row ${i + 1}`} onClick={() => set(getValues("attributes").filter((__, n) => n !== i))} className="tap-target grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-sale">
              ✕
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

function SeoSection() {
  const { register, control, formState } = useFormContextTyped();
  const title = useWatch({ control, name: "seoTitle" }) ?? "";
  const desc = useWatch({ control, name: "seoDescription" }) ?? "";
  return (
    <details className="group rounded-lg border border-border" open={Boolean(formState.errors.seoTitle || formState.errors.seoDescription) || undefined}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-h4 text-foreground">
        Search engine listing (SEO)
        <ChevronDownIcon aria-hidden className="size-5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-5 px-4 pb-4">
        <Field id="seoTitle" label="Page title" hint={`${title.length}/70. Empty uses the product name.`} error={formState.errors.seoTitle?.message}>
          <input id="seoTitle" {...register("seoTitle")} maxLength={70} className={fieldInput} />
        </Field>
        <Field id="seoDescription" label="Meta description" hint={`${desc.length}/160. Empty uses the short summary.`} error={formState.errors.seoDescription?.message}>
          <textarea id="seoDescription" {...register("seoDescription")} rows={3} maxLength={160} className={cn(fieldInput, "h-auto py-3")} />
        </Field>
      </div>
    </details>
  );
}

const useFormContextTyped = () => useFormContext<ProductFormValues>();
