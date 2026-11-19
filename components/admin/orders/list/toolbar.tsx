"use client";

import { ArrowUpDownIcon, CheckIcon, DownloadIcon, EllipsisIcon, ListFilterIcon, PrinterIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { fieldInput } from "@/components/admin/products/form/fields";
import { AdaptiveSheet } from "@/components/shared/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatDhaka, dhakaMidnight } from "@/lib/admin/date-range";
import {
  CLEARED_FILTERS,
  hasOrderFilters,
  METHOD_FILTERS,
  ORDER_SORT_LABELS,
  ORDER_SORTS,
  ORDER_TABS,
  orderParamsHref,
  orderParamsQuery,
  PAYMENT_FILTERS,
  STATUS_FILTERS,
  type OrderListParams,
  type OrderTabKey,
} from "@/lib/admin/orders/params";
import { DISTRICTS } from "@/lib/config/districts";
import { ADMIN_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders/status";
import { cn } from "@/lib/utils";
import { invoicesHref, printInvoice } from "../print-invoice";

const ALL = "__all";
const iconBox = "tap-target grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted";

const STATUS_LABEL = (s: (typeof STATUS_FILTERS)[number]) => ADMIN_STATUS_LABELS[s.toUpperCase() as keyof typeof ADMIN_STATUS_LABELS];
const METHOD_LABEL: Record<(typeof METHOD_FILTERS)[number], string> = { bkash: "bKash", sslcommerz: "SSLCommerz (card / bank)", cod: "Cash on delivery" };
const PAYMENT_LABEL = (p: (typeof PAYMENT_FILTERS)[number]) => PAYMENT_STATUS_LABELS[p.toUpperCase() as keyof typeof PAYMENT_STATUS_LABELS];

/**
 * Order Management.png toolbar: status tabs in a mint pill (active tab white with
 * its count in green), "Search order report" (debounced, ?q=: order number,
 * customer name, email, phone), filter (sheet), sort (⇅) and ⋯.
 */
export function OrderListToolbar({ params, counts }: { params: OrderListParams; counts: Record<OrderTabKey, number> }) {
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
      startTransition(() => router.replace(orderParamsHref(params, { q: value.trim() }), { scroll: false }));
    }, 300);
  };

  const query = orderParamsQuery(params, { page: params.page });
  const exportHref = `/admin/orders/export${query ? `?${query}` : ""}`;
  const printHref = invoicesHref(query);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 laptop:flex-nowrap">
        <nav aria-label="Order status" className="flex max-w-full overflow-x-auto rounded-lg bg-secondary p-1 [scrollbar-width:none]">
          {ORDER_TABS.map((t) => {
            const active = params.tab === t.key;
            return (
              <Link
                key={t.key}
                href={orderParamsHref(params, { tab: t.key })}
                replace
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap-target inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-lead whitespace-nowrap transition-colors",
                  active ? "bg-card font-medium text-foreground shadow-sm" : "text-text-body hover:text-foreground",
                )}
              >
                {t.label}
                {(active || t.key === "pending") && (
                  <span className={cn("text-copy tabular-nums", active ? "text-primary" : "text-muted-foreground")}>({counts[t.key].toLocaleString("en-US")})</span>
                )}
              </Link>
            );
          })}
        </nav>

        <search className="relative min-w-0 flex-1 basis-full tablet:basis-auto laptop:ml-auto laptop:max-w-78" aria-busy={pending}>
          <label htmlFor="order-search" className="sr-only">
            Search orders by number, customer name, email or phone
          </label>
          <input
            id="order-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              pushQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushQuery(q);
            }}
            placeholder="Search order report"
            autoComplete="off"
            className="h-10 w-full rounded-lg bg-muted pr-11 pl-3 text-copy text-foreground outline-none placeholder:text-text-body focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
          />
          <SearchIcon aria-hidden className={cn("pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2 stroke-[1.5] text-foreground", pending && "animate-pulse")} />
        </search>

        <div className="ml-auto flex shrink-0 items-center gap-3 laptop:ml-0">
          <FilterSheet params={params} />
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Sort: ${ORDER_SORT_LABELS[params.sort]}`} title="Sort" className={cn(iconBox, params.sort !== "newest" && "border-primary text-primary")}>
              <ArrowUpDownIcon aria-hidden className="size-5 stroke-[1.5]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel className="text-caption text-muted-foreground">Sort by</DropdownMenuLabel>
              {ORDER_SORTS.map((s) => (
                <DropdownMenuItem key={s} asChild>
                  <Link href={orderParamsHref(params, { sort: s })} replace scroll={false}>
                    <CheckIcon aria-hidden className={cn(params.sort === s ? "opacity-100" : "opacity-0")} /> {ORDER_SORT_LABELS[s]}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More list actions" className={iconBox}>
              <EllipsisIcon aria-hidden className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem asChild>
                <a href={exportHref} download>
                  <DownloadIcon aria-hidden /> Export CSV (current filters)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => printInvoice(printHref)}>
                <PrinterIcon aria-hidden /> Print invoices (this page)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.refresh()}>
                <RefreshCwIcon aria-hidden /> Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasOrderFilters(params) && <ActiveFilters params={params} />}
    </div>
  );
}

type Draft = Pick<OrderListParams, "status" | "method" | "payment" | "from" | "to" | "district" | "flagged">;

function FilterSheet({ params }: { params: OrderListParams }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(params);
  const active = [params.status, params.method, params.payment, params.from || params.to, params.district, params.flagged].filter(Boolean).length;
  const onOpenChange = (o: boolean) => {
    if (o) setDraft(params); // start from the URL each time
    setOpen(o);
  };
  const apply = () => {
    setOpen(false);
    router.push(orderParamsHref(params, draft));
  };
  const reset = () => {
    setOpen(false);
    router.push(orderParamsHref(params, { ...CLEARED_FILTERS, q: params.q }));
  };

  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filter orders"
      trigger={
        <button type="button" aria-label={active ? `Filters (${active} active)` : "Filters"} title="Filters" className={cn(iconBox, "relative")}>
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
          label="Order status"
          value={draft.status}
          onChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}
          options={STATUS_FILTERS.map((s) => ({ value: s, label: STATUS_LABEL(s) }))}
        />
        <FilterSelect
          label="Payment method"
          value={draft.method}
          onChange={(v) => setDraft({ ...draft, method: v as Draft["method"] })}
          options={METHOD_FILTERS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        />
        <FilterSelect
          label="Payment status"
          value={draft.payment}
          onChange={(v) => setDraft({ ...draft, payment: v as Draft["payment"] })}
          options={PAYMENT_FILTERS.map((p) => ({ value: p, label: PAYMENT_LABEL(p) }))}
        />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-copy font-bold text-foreground">Order date (Dhaka time)</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-caption text-text-body">
              From
              <input
                type="date"
                value={draft.from ?? ""}
                max={draft.to ?? undefined}
                onChange={(e) => setDraft({ ...draft, from: e.target.value || null })}
                className={cn(fieldInput, "h-11 bg-card text-copy")}
              />
            </label>
            <label className="flex flex-col gap-1 text-caption text-text-body">
              To
              <input
                type="date"
                value={draft.to ?? ""}
                min={draft.from ?? undefined}
                onChange={(e) => setDraft({ ...draft, to: e.target.value || null })}
                className={cn(fieldInput, "h-11 bg-card text-copy")}
              />
            </label>
          </div>
        </fieldset>
        <FilterSelect
          label="District"
          value={draft.district}
          onChange={(v) => setDraft({ ...draft, district: v })}
          options={DISTRICTS.map((d) => ({ value: d, label: d }))}
          allLabel="All districts"
        />
        <Label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 text-copy font-normal text-foreground">
          <span>
            <span className="block font-bold">Flagged COD phones</span>
            <span className="text-caption text-muted-foreground">Phones with earlier cancelled COD orders</span>
          </span>
          <Switch checked={draft.flagged} onCheckedChange={(flagged) => setDraft({ ...draft, flagged })} />
        </Label>
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
  const id = `order-filter-${label.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-copy font-bold text-foreground">
        {label}
      </label>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger id={id} className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72">
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
function ActiveFilters({ params }: { params: OrderListParams }) {
  const chips: { label: string; href: string }[] = [];
  const day = (k: string) => formatDhaka(dhakaMidnight(k), "d MMM yyyy");
  if (params.q) chips.push({ label: `“${params.q}”`, href: orderParamsHref(params, { q: "" }) });
  if (params.status) chips.push({ label: STATUS_LABEL(params.status), href: orderParamsHref(params, { status: null }) });
  if (params.method) chips.push({ label: METHOD_LABEL[params.method], href: orderParamsHref(params, { method: null }) });
  if (params.payment) chips.push({ label: PAYMENT_LABEL(params.payment), href: orderParamsHref(params, { payment: null }) });
  if (params.from || params.to) {
    const label = params.from && params.to ? `${day(params.from)} – ${day(params.to)}` : params.from ? `From ${day(params.from)}` : `Until ${day(params.to!)}`;
    chips.push({ label, href: orderParamsHref(params, { from: null, to: null }) });
  }
  if (params.district) chips.push({ label: params.district, href: orderParamsHref(params, { district: null }) });
  if (params.flagged) chips.push({ label: "Flagged COD", href: orderParamsHref(params, { flagged: false }) });

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
          href={orderParamsHref(params, CLEARED_FILTERS)}
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
