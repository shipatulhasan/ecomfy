"use client";

import { CirclePlusIcon, DownloadIcon, ListFilterIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AdaptiveSheet } from "@/components/shared/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hasProductFilters, productParamsHref, type ProductListParams } from "@/lib/admin/products/params";
import type { ProductFilterOptions } from "@/lib/queries/admin/products";
import { cn } from "@/lib/utils";

const ALL = "__all";
const iconBox = "tap-target grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted";

/**
 * Product List.png toolbar: "Search Products" field (debounced, ?q=), filter
 * button (category / status / stock / brand in a sheet), "+" (Add Product) and
 * download (CSV of the current filters).
 */
export function ProductListToolbar({
  params,
  options,
  canWrite,
}: {
  params: ProductListParams;
  options: ProductFilterOptions;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState(params.q);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Back/forward or a cleared filter changes the URL: follow it.
  const [urlQ, setUrlQ] = useState(params.q);
  if (urlQ !== params.q) {
    setUrlQ(params.q);
    setQ(params.q);
  }

  const pushQuery = (value: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (value.trim() === params.q) return;
      startTransition(() => router.replace(productParamsHref(params, { q: value.trim() }), { scroll: false }));
    }, 300);
  };

  const exportHref = `/admin/products/export${productParamsHref(params).replace("/admin/products", "")}`;
  const active = [params.category, params.status, params.stock, params.brand].filter(Boolean).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 tablet:flex-nowrap">
        <search className="relative min-w-0 flex-1 basis-full tablet:basis-auto" aria-busy={pending}>
          <label htmlFor="product-search" className="sr-only">
            Search products by name or SKU
          </label>
          <input
            id="product-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              pushQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushQuery(q);
            }}
            placeholder="Search Products"
            autoComplete="off"
            className="h-10 w-full rounded-lg bg-muted pr-11 pl-3 text-copy text-foreground outline-none placeholder:text-text-body focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
          />
          <SearchIcon aria-hidden className={cn("pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2 stroke-[1.5] text-foreground", pending && "animate-pulse")} />
        </search>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <FilterSheet params={params} options={options} active={active} />
          {canWrite && (
            <Link href="/admin/products/new" aria-label="Add product" title="Add product" className={cn(iconBox, "size-11 border-primary bg-primary text-primary-foreground hover:bg-primary-hover")}>
              <CirclePlusIcon aria-hidden className="size-6 stroke-[1.5]" />
            </Link>
          )}
          <a href={exportHref} download aria-label="Download CSV" title="Download CSV (current filters)" className={cn(iconBox, "size-11")}>
            <DownloadIcon aria-hidden className="size-6 stroke-[1.5]" />
          </a>
        </div>
      </div>

      {hasProductFilters(params) && <ActiveFilters params={params} options={options} />}
    </div>
  );
}

function FilterSheet({ params, options, active }: { params: ProductListParams; options: ProductFilterOptions; active: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const onOpenChange = (o: boolean) => {
    if (o) setDraft(params); // start from the URL each time
    setOpen(o);
  };

  const apply = () => {
    setOpen(false);
    router.push(productParamsHref(params, { category: draft.category, status: draft.status, stock: draft.stock, brand: draft.brand }));
  };
  const reset = () => {
    setOpen(false);
    router.push(productParamsHref(params, { category: null, status: null, stock: null, brand: null }));
  };

  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filter products"
      trigger={
        <button type="button" aria-label={active ? `Filters (${active} active)` : "Filters"} className={cn(iconBox, "relative")}>
          <ListFilterIcon aria-hidden className="size-5 stroke-[1.5]" />
          {active > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid size-4.5 place-items-center rounded-full bg-primary text-caption font-bold text-primary-foreground">
              {active}
            </span>
          )}
        </button>
      }
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={reset}>
            Reset
          </Button>
          <Button type="button" className="h-11 flex-1" onClick={apply}>
            Apply
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <FilterSelect
          label="Category"
          value={draft.category}
          onChange={(category) => setDraft({ ...draft, category })}
          options={options.categories.map((c) => ({ value: c.slug, label: c.name }))}
        />
        <FilterSelect
          label="Status"
          value={draft.status}
          onChange={(status) => setDraft({ ...draft, status: status as ProductListParams["status"] })}
          options={[
            { value: "published", label: "Published" },
            { value: "draft", label: "Draft" },
            { value: "archived", label: "Archived" },
          ]}
          allLabel="Published & draft"
        />
        <FilterSelect
          label="Stock"
          value={draft.stock}
          onChange={(stock) => setDraft({ ...draft, stock: stock as ProductListParams["stock"] })}
          options={[
            { value: "in", label: "In stock" },
            { value: "low", label: "Low stock" },
            { value: "out", label: "Out of stock" },
          ]}
        />
        <FilterSelect
          label="Brand"
          value={draft.brand}
          onChange={(brand) => setDraft({ ...draft, brand })}
          options={options.brands.map((b) => ({ value: b, label: b }))}
        />
      </div>
    </AdaptiveSheet>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const id = `filter-${label.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-copy font-bold text-foreground">
        {label}
      </label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Chips for the active filters (not in the PNG): each removes itself; "Clear all". */
function ActiveFilters({ params, options }: { params: ProductListParams; options: ProductFilterOptions }) {
  const chips: { label: string; href: string }[] = [];
  if (params.q) chips.push({ label: `“${params.q}”`, href: productParamsHref(params, { q: "" }) });
  if (params.category) {
    const c = options.categories.find((x) => x.slug === params.category);
    chips.push({ label: c?.name ?? params.category, href: productParamsHref(params, { category: null }) });
  }
  if (params.status) chips.push({ label: params.status[0]!.toUpperCase() + params.status.slice(1), href: productParamsHref(params, { status: null }) });
  if (params.stock) chips.push({ label: { in: "In stock", low: "Low stock", out: "Out of stock" }[params.stock], href: productParamsHref(params, { stock: null }) });
  if (params.brand) chips.push({ label: params.brand, href: productParamsHref(params, { brand: null }) });

  return (
    <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <li key={c.label}>
          <Link
            href={c.href}
            replace
            scroll={false}
            className="tap-target inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-caption font-medium text-secondary-foreground hover:bg-accent"
          >
            {c.label}
            <XIcon aria-label="Remove filter" className="size-3.5" />
          </Link>
        </li>
      ))}
      <li>
        <Link
          href={productParamsHref(params, { q: "", category: null, status: null, stock: null, brand: null })}
          replace
          scroll={false}
          className="tap-target inline-flex items-center px-2 text-caption text-muted-foreground underline-offset-2 hover:underline"
        >
          Clear all
        </Link>
      </li>
    </ul>
  );
}
