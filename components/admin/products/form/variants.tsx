"use client";

import { PlusIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useFormContext, useWatch, type FieldPath } from "react-hook-form";
import { combinations, slugify, variantKey } from "@/lib/admin/products/rules";
import { VARIANT_OPTIONS, type ProductFormValues } from "@/lib/validations/admin-product";
import { cn } from "@/lib/utils";
import { FieldError, fieldInput } from "./fields";

type Option = ProductFormValues["options"][number];
type Row = ProductFormValues["variants"][number];

/** Add Product "Select your color" swatches (token colors) → Color option values. */
export const COLOR_SWATCHES = [
  { name: "Green", className: "bg-swatch-mint" },
  { name: "Pink", className: "bg-swatch-rose" },
  { name: "Silver", className: "bg-swatch-silver" },
  { name: "Cream", className: "bg-swatch-cream" },
  { name: "Black", className: "bg-swatch-graphite" },
] as const;

/**
 * Options → variant rows. Rows whose combination still exists keep their id,
 * prices, SKU and stock; new combinations start from the default variant's
 * price. No options = one row (key "").
 */
export function syncVariants(options: Option[], rows: Row[], productSku: string): Row[] {
  const base = rows[0];
  const combos = combinations(options);
  if (combos.length === 0) {
    const keep = rows.find((r) => r.key === "") ?? base;
    return [
      {
        id: keep?.id,
        key: "",
        name: keep && keep.key === "" ? keep.name : "Standard",
        sku: keep?.sku || productSku,
        price: base?.price ?? 0,
        discount: base?.discount ?? null,
        stock: keep?.stock ?? 0,
        size: null,
        color: null,
        weightGrams: keep?.weightGrams ?? null,
      },
    ];
  }
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return combos.map((c) => {
    const key = variantKey(c);
    const existing = byKey.get(key);
    if (existing) return existing;
    const parts = [c.Color, c.Size].filter(Boolean) as string[];
    return {
      key,
      name: parts.join(" / "),
      sku: `${productSku || "SKU"}-${slugify(parts.join("-")).toUpperCase()}`.slice(0, 40),
      price: base?.price ?? 0,
      discount: base?.discount ?? null,
      stock: 0,
      size: c.Size ?? null,
      color: c.Color ?? null,
      weightGrams: null,
    };
  });
}

/** Variants card (not in the PNG): Size / Color options and the generated rows. */
export function VariantsSection({ disabled }: { disabled?: boolean }) {
  const form = useFormContext<ProductFormValues>();
  const options = useWatch({ control: form.control, name: "options" });
  const rows = useWatch({ control: form.control, name: "variants" });
  const track = useWatch({ control: form.control, name: "trackInventory" });
  const errors = form.formState.errors;

  const setOptions = (next: Option[]) => {
    form.setValue("options", next, { shouldDirty: true });
    form.setValue("variants", syncVariants(next, form.getValues("variants"), form.getValues("sku")), { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  };
  const missing = VARIANT_OPTIONS.filter((n) => !options.some((o) => o.name === n));
  const multi = options.length > 0;

  const applyToAll = () => {
    const first = form.getValues("variants.0");
    form.setValue(
      "variants",
      form.getValues("variants").map((r) => ({ ...r, price: first.price, discount: first.discount })),
      { shouldDirty: true },
    );
  };

  return (
    <section aria-labelledby="variants-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="variants-title" className="text-h3 text-foreground">
          Variants
        </h3>
        {!disabled && missing.length > 0 && (
          <div className="flex gap-2">
            {missing.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setOptions([...options, { name: n, values: [] }])}
                className="tap-target inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-copy text-foreground hover:bg-muted"
              >
                <PlusIcon aria-hidden className="size-4" /> {n}
              </button>
            ))}
          </div>
        )}
      </div>

      {!multi && (
        <div className="grid gap-4 tablet:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-lead font-medium text-foreground">Unit / pack size</span>
            <input {...form.register("variants.0.name")} placeholder="1 kg" className={fieldInput} aria-invalid={!!errors.variants?.[0]?.name} disabled={disabled} />
            <FieldError message={errors.variants?.[0]?.name?.message} />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-lead font-medium text-foreground">Weight (g)</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              {...form.register("variants.0.weightGrams", { setValueAs: nullableNumber })}
              className={fieldInput}
              disabled={disabled}
            />
          </label>
          <p className="text-caption text-muted-foreground tablet:col-span-2">Add Size or Color to sell this product in several options, each with its own price, SKU and stock.</p>
        </div>
      )}

      {options.map((o, oi) => (
        <OptionEditor
          key={o.name}
          option={o}
          disabled={disabled}
          error={(errors.options?.[oi]?.values as { message?: string } | undefined)?.message}
          onChange={(values) => setOptions(options.map((x, i) => (i === oi ? { ...x, values } : x)))}
          onRemove={() => setOptions(options.filter((_, i) => i !== oi))}
        />
      ))}

      {multi && rows.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="text-copy text-text-body">
              {rows.length} variant{rows.length === 1 ? "" : "s"}. The first is the default on product cards.
            </p>
            {!disabled && (
              <button type="button" onClick={applyToAll} className="tap-target text-copy font-medium text-primary hover:underline">
                Apply first price to all
              </button>
            )}
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-160 text-left text-copy">
              <thead className="bg-secondary text-foreground">
                <tr className="h-10">
                  <th scope="col" className="px-3 font-medium">Variant</th>
                  <th scope="col" className="px-2 font-medium">SKU</th>
                  <th scope="col" className="px-2 font-medium">Price (৳)</th>
                  <th scope="col" className="px-2 font-medium">Discount (৳)</th>
                  <th scope="col" className="px-2 font-medium">Stock</th>
                  <th scope="col" className="px-2 font-medium">Weight (g)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r, i) => {
                  const e = errors.variants?.[i];
                  const cell = "h-9 w-full min-w-0 rounded-md border border-border bg-card px-2 text-copy outline-none focus-visible:border-primary aria-invalid:border-destructive";
                  return (
                    <tr key={r.key} className="align-top">
                      <th scope="row" className="px-3 py-2.5 font-medium text-foreground">
                        {r.name}
                      </th>
                      <td className="px-2 py-1.5">
                        <input aria-label={`${r.name} SKU`} {...form.register(`variants.${i}.sku`)} aria-invalid={!!e?.sku} className={cn(cell, "min-w-28")} disabled={disabled} />
                        <FieldError message={e?.sku?.message} />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumberField
                          name={`variants.${i}.price`}
                          aria-label={`${r.name} price`}
                          step="0.01"
                          min={0}
                          inputMode="decimal"
                          className={cn(cell, "min-w-20")}
                          disabled={disabled}
                        />
                        <FieldError message={e?.price?.message} />
                      </td>
                      <td className="px-2 py-1.5">
                        <NumberField
                          name={`variants.${i}.discount`}
                          nullable
                          aria-label={`${r.name} discount`}
                          step="0.01"
                          min={0}
                          inputMode="decimal"
                          className={cn(cell, "min-w-20")}
                          disabled={disabled}
                        />
                        <FieldError message={e?.discount?.message} />
                      </td>
                      <td className="px-2 py-1.5">
                        {track ? (
                          <>
                            <NumberField
                              name={`variants.${i}.stock`}
                              aria-label={`${r.name} stock`}
                              min={0}
                              inputMode="numeric"
                              className={cn(cell, "min-w-18")}
                              disabled={disabled}
                            />
                            <FieldError message={e?.stock?.message} />
                          </>
                        ) : (
                          <span className="inline-block py-2 text-muted-foreground">Unlimited</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          aria-label={`${r.name} weight in grams`}
                          type="number"
                          min={1}
                          inputMode="numeric"
                          {...form.register(`variants.${i}.weightGrams`, { setValueAs: nullableNumber })}
                          className={cn(cell, "min-w-18")}
                          disabled={disabled}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <FieldError message={errors.variants?.message ?? errors.variants?.root?.message ?? errors.options?.message} />
    </section>
  );
}

function OptionEditor({
  option,
  disabled,
  error,
  onChange,
  onRemove,
}: {
  option: Option;
  disabled?: boolean;
  error?: string;
  onChange: (values: string[]) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !option.values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...option.values, v]);
    setDraft("");
  };
  const id = `option-${option.name.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-lead font-medium text-foreground">
          {option.name}
        </label>
        {!disabled && (
          <button type="button" onClick={onRemove} className="tap-target text-copy text-muted-foreground hover:text-sale">
            Remove
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {option.values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-copy text-secondary-foreground">
            {v}
            {!disabled && (
              <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(option.values.filter((x) => x !== v))} className="tap-target grid size-5 place-items-center rounded-full hover:bg-accent">
                <XIcon aria-hidden className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            id={id}
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              }
            }}
            onBlur={add}
            placeholder={option.name === "Size" ? "Add a size (e.g. 500 g), Enter" : "Add a color, Enter"}
            className="h-8 min-w-40 flex-1 rounded-md border border-transparent bg-transparent px-1 text-copy outline-none focus-visible:border-border"
          />
        )}
      </div>
      <FieldError message={error} />
    </div>
  );
}

/**
 * Number input bound to a form path through a Controller, so the Pricing card
 * and the variants table can both edit variants.0.* without two DOM inputs
 * fighting over one registration.
 */
export function NumberField({
  name,
  nullable,
  className,
  ...props
}: { name: FieldPath<ProductFormValues>; nullable?: boolean } & Omit<React.ComponentProps<"input">, "name" | "value" | "onChange" | "type">) {
  const { control } = useFormContext<ProductFormValues>();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <input
          {...props}
          ref={field.ref}
          name={field.name}
          type="number"
          value={field.value === null || field.value === undefined || Number.isNaN(field.value) ? "" : String(field.value)}
          onChange={(e) => field.onChange(e.target.value === "" ? (nullable ? null : Number.NaN) : e.target.valueAsNumber)}
          onBlur={field.onBlur}
          aria-invalid={!!fieldState.error || undefined}
          className={className}
        />
      )}
    />
  );
}

export const nullableNumber = (v: unknown) => (v === "" || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
