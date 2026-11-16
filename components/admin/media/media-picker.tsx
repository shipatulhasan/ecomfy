"use client";

import { CheckIcon, SearchIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { AdaptiveSheet } from "@/components/shared/adaptive-sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { browseMedia } from "@/lib/actions/admin-product-reads";
import type { MediaItem } from "@/lib/admin/media";
import { cn } from "@/lib/utils";

/**
 * "Browse" on Add Product: pick images already in the media library (Product
 * Media) and insert them into the product. Already-attached images are marked.
 */
export function MediaPicker({
  trigger,
  attached,
  onPick,
}: {
  trigger: React.ReactElement;
  attached: Set<string>;
  onPick: (items: MediaItem[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MediaItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Map<string, MediaItem>>(new Map());
  const [loading, startLoading] = useTransition();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      startLoading(async () => {
        const res = await browseMedia({ q, page: 1 });
        if (res.ok) {
          setItems(res.data.items);
          setError(null);
        } else setError(res.error);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [open, q]);

  const toggle = (m: MediaItem) =>
    setPicked((p) => {
      const next = new Map(p);
      if (next.has(m.id)) next.delete(m.id);
      else next.set(m.id, m);
      return next;
    });

  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setPicked(new Map());
      }}
      title="Media library"
      description="Choose images to add to this product."
      sideClassName="w-full tablet:max-w-160"
      trigger={trigger}
      footer={
        <Button
          type="button"
          className="h-11 w-full"
          disabled={picked.size === 0}
          onClick={() => {
            onPick([...picked.values()]);
            setOpen(false);
            setPicked(new Map());
          }}
        >
          {picked.size ? `Add ${picked.size} image${picked.size === 1 ? "" : "s"}` : "Select images"}
        </Button>
      }
    >
      <div className="flex flex-col gap-3 py-2">
        <div className="relative">
          <label htmlFor="media-picker-search" className="sr-only">
            Search the media library
          </label>
          <input
            id="media-picker-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by file name or alt text"
            className="h-10 w-full rounded-lg bg-muted pr-10 pl-3 text-copy outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
          />
          <SearchIcon aria-hidden className="absolute top-1/2 right-3 size-5 -translate-y-1/2 text-muted-foreground" />
        </div>
        {error && <p className="text-copy text-destructive">{error}</p>}
        {items === null || (loading && items.length === 0) ? (
          <div className="grid grid-cols-3 gap-2 tablet:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-copy text-muted-foreground">No images found. Upload them with “Add Image”.</p>
        ) : (
          <ul className={cn("grid grid-cols-3 gap-2 tablet:grid-cols-4", loading && "opacity-60")}>
            {items.map((m) => {
              const on = picked.has(m.id);
              const already = attached.has(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    disabled={already}
                    aria-pressed={on}
                    onClick={() => toggle(m)}
                    title={already ? "Already on this product" : m.originalName}
                    className={cn(
                      "relative block aspect-square w-full overflow-hidden rounded-lg border-2 border-transparent bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                      on && "border-primary",
                      already && "opacity-40",
                    )}
                  >
                    <Image src={m.url} alt={m.alt || m.originalName} fill sizes="160px" className="object-contain p-1" />
                    {on && (
                      <span className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-primary text-primary-foreground">
                        <CheckIcon aria-hidden className="size-4" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdaptiveSheet>
  );
}
