"use client";

import { ChevronsUpDownIcon, ChevronDownIcon, ChevronUpIcon, PackageIcon, PackageSearchIcon, XIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusChip } from "@/components/shared/status-chip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { bulkSetCategory, bulkSetStatus, deleteProducts } from "@/lib/actions/admin-products";
import { formatDhaka } from "@/lib/admin/date-range";
import { hasProductFilters, nextSort, productParamsHref, type ProductListParams, type ProductSortKey } from "@/lib/admin/products/params";
import type { StockLevel } from "@/lib/admin/products/rules";
import { formatPrice } from "@/lib/money";
import type { StatusTone } from "@/lib/orders/status";
import type { AdminProductPage, AdminProductRow } from "@/lib/queries/admin/products";
import { cn } from "@/lib/utils";
import { ProductPagination } from "./pagination";
import { DeleteDialog, deletedMessage, RowActions, RowActionsSheet } from "./row-actions";
import { useProductAction } from "./use-product-action";

export const STATUS_CHIP: Record<AdminProductRow["status"], { label: string; tone: StatusTone }> = {
  PUBLISHED: { label: "Published", tone: "success" },
  DRAFT: { label: "Draft", tone: "neutral" },
  ARCHIVED: { label: "Archived", tone: "warning" },
};

const STOCK: Record<StockLevel, { label: string; text: string; dot: string }> = {
  in: { label: "In stock", text: "text-foreground", dot: "bg-success" },
  low: { label: "Low stock", text: "text-warning-strong", dot: "bg-warning" },
  out: { label: "Out of stock", text: "text-sale", dot: "bg-sale" },
  unlimited: { label: "Unlimited", text: "text-foreground", dot: "bg-success" },
};

type Category = { id: string; name: string; slug: string };

/**
 * Product List.png table (laptop+) and cards (below), with row selection and the
 * bulk bar (not in the PNG): Publish, Set to draft, Archive, Change category,
 * Delete. Rows are server data; actions refresh them.
 */
export function ProductListView({
  params,
  page,
  categories,
  canWrite,
}: {
  params: ProductListParams;
  page: AdminProductPage;
  categories: Category[];
  canWrite: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const ids = useMemo(() => page.rows.map((r) => r.id), [page.rows]);
  // Drop selections that left the page (after a refresh / filter change).
  const live = useMemo(() => new Set([...selected].filter((id) => ids.includes(id))), [selected, ids]);
  const all = ids.length > 0 && live.size === ids.length;

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const next = new Set(s);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const toggleAll = (on: boolean) => setSelected(on ? new Set(ids) : new Set());

  if (page.rows.length === 0) return <EmptyState params={params} canWrite={canWrite} />;

  return (
    <div className="mt-6">
      <p aria-live="polite" className="sr-only">
        {page.total} products, page {page.page} of {page.pages}
      </p>

      {/* Laptop+: the PNG table (scrolls inside the card if the column gets narrow). */}
      <div className="hidden overflow-x-auto rounded-lg border border-border laptop:block">
        <table className="w-full min-w-250 table-fixed text-left text-copy text-foreground">
          <colgroup>
            <col className="w-12" />
            <col className="w-[22.8%]" />
            <col span={7} />
          </colgroup>
          <thead className="bg-secondary">
            <tr className="h-12.5">
              <th scope="col" className="pl-3">
                {canWrite && (
                  <Checkbox
                    aria-label="Select all products on this page"
                    checked={all ? true : live.size > 0 ? "indeterminate" : false}
                    onCheckedChange={(v) => toggleAll(v === true)}
                    className="size-5 rounded border-foreground/60 bg-card"
                  />
                )}
              </th>
              <SortHeader params={params} k="product" label="Product" />
              <SortHeader params={params} k="price" label="Price" />
              <SortHeader params={params} k="sku" label="SKU" />
              <SortHeader params={params} k="qty" label="QTY" />
              <SortHeader params={params} k="category" label="Category" />
              <SortHeader params={params} k="date" label="Date" />
              <SortHeader params={params} k="status" label="Status" />
              <th scope="col" className="px-3 font-medium">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {page.rows.map((r) => (
              <tr key={r.id} className={cn("h-17.5 transition-colors", live.has(r.id) && "bg-secondary/40")}>
                <td className="pl-3">
                  {canWrite && (
                    <Checkbox
                      aria-label={`Select ${r.name}`}
                      checked={live.has(r.id)}
                      onCheckedChange={(v) => toggle(r.id, v === true)}
                      className="size-5 rounded border-foreground/60"
                    />
                  )}
                </td>
                <td className="px-3">
                  <ProductCell row={r} />
                </td>
                <td className="px-3">
                  <Price row={r} />
                </td>
                <td className="truncate px-3 text-text-body" title={r.sku}>
                  {r.sku}
                </td>
                <td className="px-3">
                  <Stock row={r} />
                </td>
                <td className="truncate px-3" title={r.category.name}>
                  {r.category.name}
                </td>
                <td className="px-3 leading-5">
                  {formatDhaka(r.createdAt, "MM/dd/yy")}
                  <br />
                  at {formatDhaka(r.createdAt, "h:mm A")}
                </td>
                <td className="px-3">
                  <StatusChip tone={STATUS_CHIP[r.status].tone} className="h-7.25 px-2.5 text-copy">
                    {STATUS_CHIP[r.status].label}
                  </StatusChip>
                </td>
                <td className="px-2">
                  <RowActions row={r} canWrite={canWrite} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Below laptop: cards. */}
      <div className="laptop:hidden">
        {canWrite && (
          <label className="flex min-h-11 items-center gap-3 px-1 text-copy text-text-body">
            <Checkbox checked={all ? true : live.size > 0 ? "indeterminate" : false} onCheckedChange={(v) => toggleAll(v === true)} className="size-5" />
            Select all on this page
          </label>
        )}
        <ul className="grid gap-3 tablet:grid-cols-2">
          {page.rows.map((r) => (
            <li key={r.id} className={cn("flex gap-3 rounded-xl border border-border p-3", live.has(r.id) && "border-primary bg-secondary/40")}>
              {canWrite && (
                <Checkbox aria-label={`Select ${r.name}`} checked={live.has(r.id)} onCheckedChange={(v) => toggle(r.id, v === true)} className="mt-3 size-5" />
              )}
              <Thumb row={r} className="size-16" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <Link href={canWrite ? `/admin/products/${r.id}` : `/product/${r.slug}`} className="min-w-0">
                    <span className="block text-caption text-primary">{r.sku}</span>
                    <span className="line-clamp-2 text-copy font-medium text-foreground">{r.name}</span>
                  </Link>
                  <RowActionsSheet row={r} canWrite={canWrite} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Price row={r} inline />
                  <Stock row={r} />
                  <StatusChip tone={STATUS_CHIP[r.status].tone}>{STATUS_CHIP[r.status].label}</StatusChip>
                </div>
                <span className="text-caption text-muted-foreground">
                  {r.category.name} · {formatDhaka(r.createdAt, "MM/dd/yy, h:mm A")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {canWrite && live.size > 0 && <BulkBar ids={[...live]} rows={page.rows} categories={categories} onDone={() => setSelected(new Set())} />}

      <ProductPagination params={params} pages={page.pages} />
    </div>
  );
}

function SortHeader({ params, k, label }: { params: ProductListParams; k: ProductSortKey; label: string }) {
  const active = params.sort.key === k;
  const Icon = !active ? ChevronsUpDownIcon : params.sort.dir === "asc" ? ChevronUpIcon : ChevronDownIcon;
  return (
    <th scope="col" aria-sort={active ? (params.sort.dir === "asc" ? "ascending" : "descending") : "none"} className="px-3 font-medium">
      <Link
        href={productParamsHref(params, { sort: nextSort(params, k), page: params.page })}
        replace
        scroll={false}
        className="flex w-full items-center justify-between gap-2 py-2 hover:text-primary"
      >
        {label}
        <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-primary" : "text-foreground/70")} />
      </Link>
    </th>
  );
}

function Thumb({ row, className }: { row: AdminProductRow; className?: string }) {
  return (
    <span className={cn("relative grid size-10.5 shrink-0 place-items-center overflow-hidden rounded-lg bg-muted", className)}>
      {row.image ? (
        <Image
          src={row.image.url}
          alt=""
          fill
          sizes="64px"
          placeholder={row.image.blurDataURL ? "blur" : "empty"}
          blurDataURL={row.image.blurDataURL ?? undefined}
          className="object-contain p-0.5"
        />
      ) : (
        <PackageIcon aria-hidden className="size-1/2 text-muted-foreground" />
      )}
    </span>
  );
}

function ProductCell({ row }: { row: AdminProductRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Thumb row={row} />
      <div className="min-w-0 leading-5.25">
        <span className="block truncate text-primary">{row.sku}</span>
        <span className="block truncate" title={row.name}>
          {row.name}
          {row.variantCount > 1 && <span className="text-muted-foreground"> · {row.variantCount} variants</span>}
        </span>
      </div>
    </div>
  );
}

function Price({ row, inline }: { row: AdminProductRow; inline?: boolean }) {
  return (
    <span className={cn("inline-flex", inline ? "items-baseline gap-1.5" : "flex-col leading-5")}>
      <span className="font-medium">{formatPrice(row.priceCents)}</span>
      {row.compareAtCents && row.compareAtCents > row.priceCents && (
        <s className="text-caption text-muted-foreground">{formatPrice(row.compareAtCents)}</s>
      )}
    </span>
  );
}

function Stock({ row }: { row: AdminProductRow }) {
  const s = STOCK[row.level];
  return (
    <span className={cn("inline-flex items-center gap-1.5", s.text)} title={s.label}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", s.dot)} />
      {row.stock === null ? "∞" : row.stock.toLocaleString("en-US")}
      <span className="sr-only">({s.label})</span>
      {row.level !== "in" && row.level !== "unlimited" && <span className="text-caption laptop:sr-only">{s.label}</span>}
    </span>
  );
}

function BulkBar({ ids, rows, categories, onDone }: { ids: string[]; rows: AdminProductRow[]; categories: Category[]; onDone: () => void }) {
  const { run, pending } = useProductAction();
  const [confirm, setConfirm] = useState(false);
  const names = rows.filter((r) => ids.includes(r.id)).map((r) => r.name);
  const n = ids.length;
  const status = (s: AdminProductRow["status"], verb: string) =>
    run(() => bulkSetStatus({ ids, status: s }), (d) => `${verb} ${d.updated} product${d.updated === 1 ? "" : "s"}`, onDone);

  return (
    <div
      role="region"
      aria-label="Bulk actions"
      className="sticky bottom-(--app-bottom-safe) z-10 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-lg"
    >
      <span className="mr-auto flex items-center gap-2 text-copy font-bold text-foreground">
        <button type="button" aria-label="Clear selection" onClick={onDone} className="tap-target grid size-8 place-items-center rounded-md hover:bg-muted">
          <XIcon aria-hidden className="size-4" />
        </button>
        {n} selected
      </span>
      <Button size="lg" className="h-10 px-4" disabled={pending} onClick={() => status("PUBLISHED", "Published")}>
        Publish
      </Button>
      <Button size="lg" variant="outline" className="h-10 px-4" disabled={pending} onClick={() => status("DRAFT", "Set to draft:")}>
        Set to draft
      </Button>
      <Button size="lg" variant="outline" className="h-10 px-4" disabled={pending} onClick={() => status("ARCHIVED", "Archived")}>
        Archive
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="lg" variant="outline" className="h-10 px-4" disabled={pending}>
            Change category
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
          <DropdownMenuLabel>Move {n} to…</DropdownMenuLabel>
          {categories.map((c) => (
            <DropdownMenuItem
              key={c.id}
              onSelect={() => run(() => bulkSetCategory({ ids, categoryId: c.id }), (d) => `Moved ${d.updated} to ${c.name}`, onDone)}
            >
              {c.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button size="lg" variant="destructive" className="h-10 px-4" disabled={pending} onClick={() => setConfirm(true)}>
        Delete
      </Button>
      <DeleteDialog open={confirm} onOpenChange={setConfirm} names={names} onConfirm={() => run(() => deleteProducts({ ids }), deletedMessage, onDone)} />
    </div>
  );
}

function EmptyState({ params, canWrite }: { params: ProductListParams; canWrite: boolean }) {
  const filtered = hasProductFilters(params);
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <PackageSearchIcon aria-hidden className="size-10 text-muted-foreground" />
      <h2 className="text-h3 text-foreground">{filtered ? "No products match" : "No products yet"}</h2>
      <p className="max-w-sm text-copy text-muted-foreground">
        {filtered ? "Try another search or clear the filters." : "Add your first product and it will show up here."}
      </p>
      {filtered ? (
        <Button asChild variant="outline" className="h-10 px-4">
          <Link href={productParamsHref(params, { q: "", category: null, status: null, stock: null, brand: null })}>Clear filters</Link>
        </Button>
      ) : (
        canWrite && (
          <Button asChild className="h-10 px-4">
            <Link href="/admin/products/new">Add product</Link>
          </Button>
        )
      )}
    </div>
  );
}
