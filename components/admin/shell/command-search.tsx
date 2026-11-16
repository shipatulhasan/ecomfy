"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { adminSearchAction, type AdminSearchResult } from "@/lib/actions/admin-search";
import { ADMIN_NAV } from "@/lib/admin/nav";
import { cn } from "@/lib/utils";

const EMPTY: AdminSearchResult = { orders: [], products: [], customers: [] };

/**
 * Topbar search (Dashboard.png: 315 field + 98 "Search" button) and the Cmd/Ctrl+K
 * command palette. Typing in the field or pressing the button opens the palette
 * with the query; results come from adminSearchAction (permission-filtered) and
 * the menu pages this user can open.
 */
export function CommandSearch({ allowed }: { allowed: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AdminSearchResult>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced server search; the latest request wins.
  useEffect(() => {
    const q = query.trim();
    if (!open || q.length < 2) return;
    const id = ++seq.current;
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await adminSearchAction({ q });
        if (id !== seq.current) return;
        if (res.ok) {
          setResult(res.data);
          setError(null);
        } else setError(res.error);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const q = query.trim().toLowerCase();
  const pages = ADMIN_NAV.flatMap((g) => g.items).filter(
    (i) => allowed.includes(i.href) && !i.external && (!q || i.label.toLowerCase().includes(q)),
  );
  const hits = q.length >= 2 ? result : EMPTY;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setOpen(true);
        }}
        className="flex h-11.25 w-full min-w-0 items-stretch laptop:w-103.25"
      >
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-l-lg border border-r-0 border-border bg-card px-4">
          <SearchIcon aria-hidden className="size-5 shrink-0 text-foreground" />
          <span className="sr-only">Search orders, products or customers</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== "Tab" && e.key !== "Shift") setOpen(true);
            }}
            placeholder="Search data, users, or reports"
            aria-keyshortcuts="Control+K Meta+K"
            className="w-full min-w-0 bg-transparent text-copy text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="submit"
          className="press shrink-0 rounded-r-lg bg-primary px-6 text-copy font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Search
        </button>
      </form>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search the admin"
        description="Orders by number, products, customers and pages"
        className="tablet:max-w-xl"
      >
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Order #, product, customer…" />
          <CommandList className={cn("max-h-96", pending && "opacity-70")}>
            <CommandEmpty>{error ?? (q.length < 2 ? "Type at least 2 characters." : "No results.")}</CommandEmpty>
            {hits.orders.length > 0 && (
              <CommandGroup heading="Orders">
                {hits.orders.map((h) => (
                  <CommandItem key={h.id} value={`order-${h.id}`} onSelect={() => go(h.href)}>
                    <Hit label={h.label} detail={h.detail} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {hits.products.length > 0 && (
              <CommandGroup heading="Products">
                {hits.products.map((h) => (
                  <CommandItem key={h.id} value={`product-${h.id}`} onSelect={() => go(h.href)}>
                    <Hit label={h.label} detail={h.detail} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {hits.customers.length > 0 && (
              <CommandGroup heading="Customers">
                {hits.customers.map((h) => (
                  <CommandItem key={h.id} value={`customer-${h.id}`} onSelect={() => go(h.href)}>
                    <Hit label={h.label} detail={h.detail} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {pages.length > 0 && (
              <CommandGroup heading="Pages">
                {pages.map((p) => (
                  <CommandItem key={p.href} value={`page-${p.href}`} onSelect={() => go(p.href)}>
                    <p.icon aria-hidden className="size-4" />
                    {p.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

function Hit({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate font-bold text-foreground">{label}</span>
      <span className="truncate text-caption text-muted-foreground">{detail}</span>
    </span>
  );
}
