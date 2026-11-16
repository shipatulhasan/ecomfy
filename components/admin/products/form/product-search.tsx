"use client";

import { PackageIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { findProducts } from "@/lib/actions/admin-product-reads";

type Hit = { id: string; name: string; sku: string; status: string; imageUrl: string | null };

/** Add Products.png header "Search product for add": open an existing product. */
export function ProductSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const t = setTimeout(
      () =>
        start(async () => {
          const res = await findProducts({ q: term });
          setHits(res.ok ? res.data : []);
          setOpen(true);
        }),
      250,
    );
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Popover open={open && q.trim().length > 0} onOpenChange={setOpen}>
      <Command shouldFilter={false} className="w-full overflow-visible bg-transparent">
        <PopoverAnchor asChild>
          <div className="relative w-full">
            <label htmlFor="product-for-add" className="sr-only">
              Search product for add
            </label>
            <input
              id="product-for-add"
              type="search"
              role="combobox"
              aria-expanded={open && q.trim().length > 0}
              aria-controls="product-for-add-list"
              aria-autocomplete="list"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => hits.length && setOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder="Search product for add"
              autoComplete="off"
              className="h-12 w-full rounded-lg border border-border bg-card pr-11 pl-3 text-lead text-foreground outline-none placeholder:text-text-body focus-visible:border-primary [&::-webkit-search-cancel-button]:hidden"
            />
            <SearchIcon aria-hidden className={`pointer-events-none absolute top-1/2 right-3 size-6 -translate-y-1/2 stroke-[1.5] ${pending ? "animate-pulse" : ""}`} />
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" onOpenAutoFocus={(e) => e.preventDefault()} className="w-(--radix-popover-trigger-width) p-0">
          <CommandList id="product-for-add-list">
            <CommandEmpty>{pending ? "Searching…" : "No products found."}</CommandEmpty>
            <CommandGroup heading="Open product">
              {(q.trim() ? hits : []).map((h) => (
                <CommandItem
                  key={h.id}
                  value={h.id}
                  onSelect={() => {
                    setOpen(false);
                    setQ("");
                    router.push(`/admin/products/${h.id}`);
                  }}
                >
                  <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-muted">
                    {h.imageUrl ? <Image src={h.imageUrl} alt="" fill sizes="32px" className="object-contain" /> : <PackageIcon aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{h.name}</span>
                  <span className="text-caption text-muted-foreground">#{h.sku}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  );
}
