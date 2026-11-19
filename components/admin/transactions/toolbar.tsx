"use client";

import { ArrowUpDownIcon, CheckIcon, DownloadIcon, EllipsisIcon, ListFilterIcon, RefreshCwIcon, SearchIcon, TriangleAlertIcon, XIcon } from "lucide-react";
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
import { dhakaMidnight, formatDhaka } from "@/lib/admin/date-range";
import {
  CLEARED_TXN_FILTERS,
  hasTxnFilters,
  toTxnStatus,
  TXN_METHOD_FILTERS,
  TXN_SORT_LABELS,
  TXN_SORTS,
  TXN_STATUS_FILTERS,
  TXN_TABS,
  TXN_TYPE_FILTERS,
  txnParamsHref,
  txnParamsQuery,
  type TxnListParams,
  type TxnTabKey,
} from "@/lib/admin/transactions/params";
import { ATTEMPT_LABEL } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

const ALL = "__all";
const iconBox = "tap-target grid size-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted";

const METHOD_LABEL: Record<(typeof TXN_METHOD_FILTERS)[number], string> = { bkash: "bKash", sslcommerz: "SSLCommerz (card / bank)", cod: "Cash on delivery" };
const TYPE_LABEL: Record<(typeof TXN_TYPE_FILTERS)[number], string> = { charge: "Online charge", refund: "Refund", cod_collection: "COD collection" };
const STATUS_LABEL = (s: (typeof TXN_STATUS_FILTERS)[number]) => ATTEMPT_LABEL[toTxnStatus(s)];

/**
 * Transaction.png toolbar: status tabs in a mint pill (active tab white with its
 * count in green), "Search Payment History" (debounced, ?q=: transaction / gateway
 * id, order number, customer name, email, phone), filter (sheet), sort (⇅) and ⋯.
 */
export function TxnToolbar({ params, counts, canExport }: { params: TxnListParams; counts: Record<TxnTabKey, number>; canExport: boolean }) {
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
      startTransition(() => router.replace(txnParamsHref(params, { q: value.trim() }), { scroll: false }));
    }, 300);
  };

  const query = txnParamsQuery(params);
  const exportHref = `/admin/transactions/export${query ? `?${query}` : ""}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 laptop:flex-nowrap">
        <nav aria-label="Transaction status" className="flex max-w-full overflow-x-auto rounded-lg bg-secondary p-1 [scrollbar-width:none]">
          {TXN_TABS.map((t) => {
            const active = params.tab === t.key;
            return (
              <Link
                key={t.key}
                href={txnParamsHref(params, { tab: t.key })}
                replace
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap-target inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-lead whitespace-nowrap transition-colors laptop:px-4",
                  active ? "bg-card font-medium text-foreground shadow-sm" : "text-text-body hover:text-foreground",
                )}
              >
                {t.label}
                {active && <span className="text-copy text-primary tabular-nums">({counts[t.key].toLocaleString("en-US")})</span>}
              </Link>
            );
          })}
        </nav>

        <search className="relative min-w-0 flex-1 basis-full tablet:basis-auto laptop:ml-auto laptop:max-w-78" aria-busy={pending}>
          <label htmlFor="txn-search" className="sr-only">
            Search transactions by transaction id, order number, customer name, email or phone
          </label>
          <input
            id="txn-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              pushQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushQuery(q);
            }}
            placeholder="Search Payment History"
            autoComplete="off"
            className="h-10 w-full rounded-lg bg-muted pr-11 pl-3 text-copy text-foreground outline-none placeholder:text-text-body focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
          />
          <SearchIcon aria-hidden className={cn("pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2 stroke-[1.5] text-foreground", pending && "animate-pulse")} />
        </search>

        <div className="ml-auto flex shrink-0 items-center gap-3 laptop:ml-0">
          <FilterSheet params={params} />
          <DropdownMenu>
            <DropdownMenuTrigger aria-label={`Sort: ${TXN_SORT_LABELS[params.sort]}`} title="Sort" className={cn(iconBox, params.sort !== "newest" && "border-primary text-primary")}>
              <ArrowUpDownIcon aria-hidden className="size-5 stroke-[1.5]" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel className="text-caption text-muted-foreground">Sort by</DropdownMenuLabel>
              {TXN_SORTS.map((s) => (
                <DropdownMenuItem key={s} asChild>
                  <Link href={txnParamsHref(params, { sort: s })} replace scroll={false}>
                    <CheckIcon aria-hidden className={cn(params.sort === s ? "opacity-100" : "opacity-0")} /> {TXN_SORT_LABELS[s]}
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
                <Link href={txnParamsHref(params, { attention: !params.attention })} replace scroll={false}>
                  <TriangleAlertIcon aria-hidden /> {params.attention ? "Show all transactions" : "Needs attention"}
                </Link>
              </DropdownMenuItem>
              {canExport && (
                <DropdownMenuItem asChild>
                  <a href={exportHref} download>
                    <DownloadIcon aria-hidden /> Export CSV (current filters)
                  </a>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => router.refresh()}>
                <RefreshCwIcon aria-hidden /> Refresh
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasTxnFilters(params) && <ActiveFilters params={params} />}
    </div>
  );
}

type Draft = Pick<TxnListParams, "method" | "status" | "type" | "from" | "to" | "min" | "max" | "attention">;

function FilterSheet({ params }: { params: TxnListParams }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(params);
  const active = [params.method, params.status, params.type, params.from || params.to, params.min !== null || params.max !== null, params.attention].filter(Boolean).length;
  const onOpenChange = (o: boolean) => {
    if (o) setDraft(params); // start from the URL each time
    setOpen(o);
  };
  const apply = () => {
    setOpen(false);
    let { min, max } = draft;
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    router.push(txnParamsHref(params, { ...draft, min, max }), { scroll: false });
  };
  const reset = () => {
    setOpen(false);
    router.push(txnParamsHref(params, { ...CLEARED_TXN_FILTERS, q: params.q }), { scroll: false });
  };
  const amount = (v: string) => (/^\d{1,9}$/.test(v) ? Number(v) : null);

  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filter transactions"
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
        <Label className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-border px-3 text-copy font-normal text-foreground">
          <span>
            <span className="block font-bold">Needs attention</span>
            <span className="text-caption text-muted-foreground">Stuck, paid on a cancelled order, amount mismatch or charged twice</span>
          </span>
          <Switch checked={draft.attention} onCheckedChange={(attention) => setDraft({ ...draft, attention })} />
        </Label>
        <FilterSelect
          label="Payment method"
          value={draft.method}
          onChange={(v) => setDraft({ ...draft, method: v as Draft["method"] })}
          options={TXN_METHOD_FILTERS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        />
        <FilterSelect
          label="Status"
          value={draft.status}
          onChange={(v) => setDraft({ ...draft, status: v as Draft["status"] })}
          options={TXN_STATUS_FILTERS.map((s) => ({ value: s, label: STATUS_LABEL(s) }))}
        />
        <FilterSelect
          label="Type"
          value={draft.type}
          onChange={(v) => setDraft({ ...draft, type: v as Draft["type"] })}
          options={TXN_TYPE_FILTERS.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
        />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-copy font-bold text-foreground">Date (Dhaka time)</legend>
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
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-copy font-bold text-foreground">Amount (৳, refunds included)</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-caption text-text-body">
              Min
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={draft.min ?? ""}
                onChange={(e) => setDraft({ ...draft, min: amount(e.target.value) })}
                className={cn(fieldInput, "h-11 bg-card text-copy")}
              />
            </label>
            <label className="flex flex-col gap-1 text-caption text-text-body">
              Max
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={draft.max ?? ""}
                onChange={(e) => setDraft({ ...draft, max: amount(e.target.value) })}
                className={cn(fieldInput, "h-11 bg-card text-copy")}
              />
            </label>
          </div>
        </fieldset>
      </div>
    </AdaptiveSheet>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
}) {
  const id = `txn-filter-${label.toLowerCase().replace(/\W+/g, "-")}`;
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
          <SelectItem value={ALL}>All</SelectItem>
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
function ActiveFilters({ params }: { params: TxnListParams }) {
  const chips: { label: string; href: string }[] = [];
  const day = (k: string) => formatDhaka(dhakaMidnight(k), "d MMM yyyy");
  if (params.attention) chips.push({ label: "Needs attention", href: txnParamsHref(params, { attention: false }) });
  if (params.q) chips.push({ label: `“${params.q}”`, href: txnParamsHref(params, { q: "" }) });
  if (params.method) chips.push({ label: METHOD_LABEL[params.method], href: txnParamsHref(params, { method: null }) });
  if (params.status) chips.push({ label: STATUS_LABEL(params.status), href: txnParamsHref(params, { status: null }) });
  if (params.type) chips.push({ label: TYPE_LABEL[params.type], href: txnParamsHref(params, { type: null }) });
  if (params.from || params.to) {
    const label = params.from && params.to ? `${day(params.from)} – ${day(params.to)}` : params.from ? `From ${day(params.from)}` : `Until ${day(params.to!)}`;
    chips.push({ label, href: txnParamsHref(params, { from: null, to: null }) });
  }
  if (params.min !== null || params.max !== null) {
    const label =
      params.min !== null && params.max !== null ? `৳${params.min} – ৳${params.max}` : params.min !== null ? `৳${params.min} or more` : `Up to ৳${params.max}`;
    chips.push({ label, href: txnParamsHref(params, { min: null, max: null }) });
  }

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
          href={txnParamsHref(params, CLEARED_TXN_FILTERS)}
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
