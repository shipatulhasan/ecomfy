"use client";

import { CheckSquareIcon, CirclePlusIcon, DownloadIcon, EllipsisIcon, ListFilterIcon, SearchIcon, ShapesIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AdaptiveSheet } from "@/components/shared/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CATEGORY_STATUS_TABS,
  categoryParamsHref,
  hasCategoryFilters,
  type CategoryListParams,
  type CategoryStatusTab,
  type ParentOption,
} from "@/lib/admin/categories/params";
import { cn } from "@/lib/utils";

const ALL = "__all";
const iconBox = "tap-target grid size-11 shrink-0 place-items-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-muted";

const TAB_LABEL: Record<CategoryStatusTab, string> = {
  all: "All Categories",
  featured: "Featured",
  active: "Active",
  inactive: "Inactive",
};

/**
 * Categories.png toolbar: status tabs in a muted pill (the active tab is white
 * with its count in green), "Search categories" (debounced, ?q=), filter (parent
 * + status in a sheet), ⊕ (create) and ⋯ (select all, export CSV).
 */
export function CategoryToolbar({
  params,
  counts,
  parents,
  canWrite,
  onCreate,
  onSelectAll,
}: {
  params: CategoryListParams;
  counts: Record<CategoryStatusTab, number>;
  parents: ParentOption[];
  canWrite: boolean;
  onCreate: () => void;
  onSelectAll: () => void;
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
      startTransition(() => router.replace(categoryParamsHref(params, { q: value.trim() }), { scroll: false }));
    }, 300);
  };

  const exportHref = `/admin/categories/export${categoryParamsHref(params, { page: 1, tiles: 1 }).replace("/admin/categories", "")}`;
  const parentName = params.parent ? parents.find((p) => p.id === params.parent)?.name : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 laptop:flex-nowrap">
        <nav aria-label="Category status" className="flex max-w-full overflow-x-auto rounded-lg bg-secondary/60 p-1 [scrollbar-width:none]">
          {CATEGORY_STATUS_TABS.map((t) => {
            const active = params.status === t;
            return (
              <Link
                key={t}
                href={categoryParamsHref(params, { status: t })}
                replace
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "tap-target inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-3 text-lead whitespace-nowrap transition-colors",
                  active ? "bg-card font-medium text-foreground shadow-sm" : "text-text-body hover:text-foreground",
                )}
              >
                {TAB_LABEL[t]}
                <span className={active ? "text-primary" : "text-muted-foreground"}>({counts[t]})</span>
              </Link>
            );
          })}
        </nav>

        <search className="relative min-w-0 flex-1 basis-full tablet:basis-auto laptop:ml-auto laptop:max-w-104" aria-busy={pending}>
          <label htmlFor="category-search" className="sr-only">
            Search categories by name or slug
          </label>
          <input
            id="category-search"
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              pushQuery(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") pushQuery(q);
            }}
            placeholder="Search categories"
            autoComplete="off"
            className="h-11 w-full rounded-lg bg-muted pr-11 pl-4 text-copy text-foreground outline-none placeholder:text-text-body focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
          />
          <SearchIcon aria-hidden className={cn("pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2 stroke-[1.5] text-foreground", pending && "animate-pulse")} />
        </search>

        <div className="ml-auto flex shrink-0 items-center gap-3 laptop:ml-0">
          <FilterSheet params={params} parents={parents} />
          {canWrite && (
            <button type="button" onClick={onCreate} aria-label="Create category" title="Create category" className={iconBox}>
              <CirclePlusIcon aria-hidden className="size-6 stroke-[1.5]" />
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More list actions" className={iconBox}>
              <EllipsisIcon aria-hidden className="size-6" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              {canWrite && (
                <DropdownMenuItem onSelect={onSelectAll}>
                  <CheckSquareIcon aria-hidden /> Select all on this page
                </DropdownMenuItem>
              )}
              <DropdownMenuItem asChild>
                <a href={exportHref} download>
                  <DownloadIcon aria-hidden /> Export CSV (current filters)
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {hasCategoryFilters(params) && (
        <ul aria-label="Active filters" className="flex flex-wrap items-center gap-2">
          {params.q && <Chip href={categoryParamsHref(params, { q: "" })} label={`“${params.q}”`} />}
          {params.parent && <Chip href={categoryParamsHref(params, { parent: null })} label={parentName ?? "Category"} />}
          {params.status !== "all" && <Chip href={categoryParamsHref(params, { status: "all" })} label={TAB_LABEL[params.status]} />}
          <li>
            <Link
              href={categoryParamsHref(params, { q: "", parent: null, status: "all" })}
              replace
              scroll={false}
              className="tap-target inline-flex items-center px-2 text-caption text-muted-foreground underline-offset-2 hover:underline"
            >
              Clear all
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}

function Chip({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        replace
        scroll={false}
        className="tap-target inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-caption font-medium text-secondary-foreground hover:bg-accent"
      >
        {label}
        <XIcon aria-label="Remove filter" className="size-3.5" />
      </Link>
    </li>
  );
}

function FilterSheet({ params, parents }: { params: CategoryListParams; parents: ParentOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const active = [params.parent, params.status !== "all"].filter(Boolean).length;
  const onOpenChange = (o: boolean) => {
    if (o) setDraft(params); // start from the URL each time
    setOpen(o);
  };
  const go = (patch: Partial<CategoryListParams>) => {
    setOpen(false);
    router.push(categoryParamsHref(params, patch));
  };

  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Filter categories"
      trigger={
        <button type="button" aria-label={active ? `Filters (${active} active)` : "Filters"} className={cn(iconBox, "relative")}>
          <ListFilterIcon aria-hidden className="size-5 stroke-[1.5]" />
          {active > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid size-4.5 place-items-center rounded-full bg-primary text-caption font-bold text-primary-foreground">{active}</span>
          )}
        </button>
      }
      footer={
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => go({ parent: null, status: "all" })}>
            Reset
          </Button>
          <Button type="button" className="h-11 flex-1" onClick={() => go({ parent: draft.parent, status: draft.status })}>
            Apply
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <FilterSelect
          label="Parent category"
          value={draft.parent}
          onChange={(parent) => setDraft({ ...draft, parent })}
          options={parents.map((p) => ({ value: p.id, label: p.name }))}
          allLabel="All categories"
        />
        <FilterSelect
          label="Status"
          value={draft.status === "all" ? null : draft.status}
          onChange={(s) => setDraft({ ...draft, status: (s ?? "all") as CategoryStatusTab })}
          options={(["featured", "active", "inactive"] as const).map((s) => ({ value: s, label: TAB_LABEL[s] }))}
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
  const id = `category-filter-${label.toLowerCase().replace(/\s+/g, "-")}`;
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

export function CategoryEmptyState({ params, canWrite, onCreate }: { params: CategoryListParams; canWrite: boolean; onCreate: () => void }) {
  const filtered = hasCategoryFilters(params);
  return (
    <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-16 text-center">
      <ShapesIcon aria-hidden className="size-10 text-muted-foreground" />
      <h2 className="text-h3 text-foreground">{filtered ? "No categories match" : "No categories yet"}</h2>
      <p className="max-w-sm text-copy text-muted-foreground">
        {filtered ? "Try another search, tab or category, or clear the filters." : "Create your first category, then add products to it."}
      </p>
      {filtered ? (
        <Button asChild variant="outline" className="h-10 px-4">
          <Link href={categoryParamsHref(params, { q: "", parent: null, status: "all" })}>Clear filters</Link>
        </Button>
      ) : (
        canWrite && (
          <Button className="h-10 px-4" onClick={onCreate}>
            Create category
          </Button>
        )
      )}
    </div>
  );
}
