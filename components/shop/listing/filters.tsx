"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { shopContent } from "@/lib/config/shop";
import { formatPriceWhole } from "@/lib/money";
import type { ShopFilterOptions } from "@/lib/queries/products";
import { DEFAULT_SORT, SHOP_SORTS, ShopParam, type ShopSort } from "@/lib/shop-params";
import { cn } from "@/lib/utils";
import { StarRating } from "../star-rating";
import { toggleValue, useShopParams } from "./use-shop-params";

/**
 * Shop filter controls (client leaves). Each one reads the URL through
 * useShopParams and writes it back with router.replace; no client data fetching.
 * Option lists and counts come from the server (getShopFilterOptions).
 */

const row = "flex cursor-pointer items-center gap-2 py-2.5 text-copy text-foreground";
const count = "text-muted-foreground";

// ── All Categories (single select) ──
export function CategoryFilter({ categories }: { categories: ShopFilterOptions["categories"] }) {
  const { params, update } = useShopParams();
  const selected = params.get(ShopParam.category) ?? "";
  // Empty categories are hidden unless they're the current one (e.g. a footer link).
  const visible = categories.filter((c) => c.count > 0 || c.slug === selected);
  return (
    <RadioGroup
      aria-label={shopContent.filters.categories}
      value={selected}
      onValueChange={(slug) => update((p) => p.set(ShopParam.category, slug))}
      className="gap-0"
    >
      {visible.map((c) => (
        <Label key={c.slug} className={row}>
          <RadioGroupItem value={c.slug} className="size-5" />
          <span>
            {c.name} <span className={count}>({c.count})</span>
          </span>
        </Label>
      ))}
    </RadioGroup>
  );
}

// ── Price (dual slider, debounced) ──
const PRICE_DEBOUNCE_MS = 400;

export function PriceFilter({ bounds }: { bounds: ShopFilterOptions["price"] }) {
  const { params } = useShopParams();
  const min = Number(params.get(ShopParam.min) ?? bounds.min);
  const max = Number(params.get(ShopParam.max) ?? bounds.max);
  // Re-mount when the URL range changes from elsewhere (chip removed, Clear all).
  return <PriceSlider key={`${min}-${max}`} bounds={bounds} initial={[min, max]} />;
}

function PriceSlider({ bounds, initial }: { bounds: ShopFilterOptions["price"]; initial: [number, number] }) {
  const { update } = useShopParams();
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  function commit([lo, hi]: number[]) {
    update((p) => {
      if (lo! <= bounds.min) p.delete(ShopParam.min);
      else p.set(ShopParam.min, String(lo));
      if (hi! >= bounds.max) p.delete(ShopParam.max);
      else p.set(ShopParam.max, String(hi));
    });
  }

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Slider
        min={bounds.min}
        max={bounds.max}
        step={1}
        minStepsBetweenThumbs={1}
        value={value}
        onValueChange={(v) => {
          setValue(v as [number, number]);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(v), PRICE_DEBOUNCE_MS);
        }}
        aria-label={shopContent.filters.price}
        className={cn(
          "py-2",
          "[&_[data-slot=slider-track]]:h-1.5 [&_[data-slot=slider-track]]:bg-muted-strong",
          "[&_[data-slot=slider-thumb]]:size-4.5 [&_[data-slot=slider-thumb]]:border-2 [&_[data-slot=slider-thumb]]:border-primary [&_[data-slot=slider-thumb]]:bg-background",
          // ≥44px touch area below laptop
          "[&_[data-slot=slider-thumb]]:after:-inset-3.5 laptop:[&_[data-slot=slider-thumb]]:after:-inset-2",
        )}
      />
      <p className="text-copy text-text-body" aria-live="polite">
        {shopContent.filters.priceLabel}{" "}
        <span className="font-medium text-foreground">
          {formatPriceWhole(value[0] * 100)} — {formatPriceWhole(value[1] * 100)}
        </span>
      </p>
    </div>
  );
}

// ── Rating (checkbox look, single minimum: "4.0 & up") ──
export function RatingFilter() {
  const { params, update } = useShopParams();
  const selected = Number(params.get(ShopParam.rating) ?? 0);
  return (
    <ul className="flex flex-col">
      {[5, 4, 3, 2, 1].map((n) => (
        <li key={n}>
          <Label className={row}>
            <Checkbox
              className="size-5"
              checked={selected === n}
              onCheckedChange={(on) =>
                update((p) => (on ? p.set(ShopParam.rating, String(n)) : p.delete(ShopParam.rating)))
              }
            />
            <StarRating rating={n} starClassName="size-4" />
            <span>{n === 5 ? "5.0" : `${n}.0 & up`}</span>
          </Label>
        </li>
      ))}
    </ul>
  );
}

// ── Popular Tag (multi-select chips) ──
export function TagFilter({ tags }: { tags: ShopFilterOptions["tags"] }) {
  const { params, update } = useShopParams();
  const selected = params.getAll(ShopParam.tag);
  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map(({ tag }) => {
        const on = selected.includes(tag);
        return (
          <li key={tag}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => update((p) => toggleValue(p, ShopParam.tag, tag))}
              className={cn(
                "tap-target rounded-full px-4 py-1.5 text-copy transition-colors",
                on
                  ? "bg-primary text-primary-foreground hover:bg-brand-dark"
                  : "bg-muted-strong text-foreground hover:bg-secondary hover:text-brand-dark",
              )}
            >
              {tag}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── Brands (multi-select) ──
export function BrandFilter({ brands }: { brands: ShopFilterOptions["brands"] }) {
  const { params, update } = useShopParams();
  const selected = params.getAll(ShopParam.brand);
  return (
    <ul className="flex flex-col">
      {brands.map(({ brand, count: n }) => (
        <li key={brand}>
          <Label className={row}>
            <Checkbox
              className="size-5"
              checked={selected.includes(brand)}
              onCheckedChange={() => update((p) => toggleValue(p, ShopParam.brand, brand))}
            />
            <span>
              {brand} <span className={count}>({n})</span>
            </span>
          </Label>
        </li>
      ))}
    </ul>
  );
}

// ── Availability ──
export function StockFilter() {
  const { params, update } = useShopParams();
  const on = params.get(ShopParam.stock) === "in";
  return (
    <Label className={row}>
      <Checkbox
        className="size-5"
        checked={on}
        onCheckedChange={(v) => update((p) => (v ? p.set(ShopParam.stock, "in") : p.delete(ShopParam.stock)))}
      />
      {shopContent.filters.inStock}
    </Label>
  );
}

// ── Sort ──
export function SortSelect({ className }: { className?: string }) {
  const id = useId();
  const { params, update } = useShopParams();
  const raw = params.get(ShopParam.sort);
  const value: ShopSort = SHOP_SORTS.includes(raw as ShopSort) ? (raw as ShopSort) : DEFAULT_SORT;
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <label htmlFor={id} className="shrink-0 text-copy text-muted-foreground">
        {shopContent.sort.label}
      </label>
      <Select
        value={value}
        onValueChange={(v) => update((p) => (v === DEFAULT_SORT ? p.delete(ShopParam.sort) : p.set(ShopParam.sort, v)))}
      >
        <SelectTrigger id={id} className="h-10.25 w-full min-w-0 rounded-sm px-4 text-copy text-text-body tablet:w-41.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" align="start">
          {shopContent.sort.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
