"use client";

import { Settings2Icon } from "lucide-react";
import { useId, useState } from "react";
import { shopContent } from "@/lib/config/shop";
import { cn } from "@/lib/utils";
import { FILTER_PILL } from "./filter-sheet";

/**
 * Shop page grid (Shop.png). Grid areas:
 *   mobile/tablet:  toolbar / main            (filters live in a Sheet)
 *   laptop+:        pill toolbar / aside main (312 design-px sidebar, 24 gap)
 *   laptop+ closed: pill toolbar / main main  (the "Filter" pill collapses the sidebar;
 *                   the product grid widens to 4 columns via group-data-[sidebar=closed]/shop)
 * Children (server-rendered) must place themselves with [grid-area:toolbar] / [grid-area:main].
 * Sidebar visibility is a UI preference, not a filter, so it isn't in the URL.
 */
export function ShopShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const asideId = useId();

  return (
    <div
      data-sidebar={open ? "open" : "closed"}
      className={cn(
        "group/shop grid grid-cols-[minmax(0,1fr)] gap-4 [grid-template-areas:'toolbar'_'main'] tablet:gap-6",
        "laptop:grid-cols-[19.5rem_minmax(0,1fr)] laptop:[grid-template-areas:'pill_toolbar'_'aside_main']",
        "laptop:data-[sidebar=closed]:grid-cols-[auto_minmax(0,1fr)] laptop:data-[sidebar=closed]:[grid-template-areas:'pill_toolbar'_'main_main']",
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={asideId}
        onClick={() => setOpen((o) => !o)}
        className={cn(FILTER_PILL, "hidden self-center justify-self-start [grid-area:pill] laptop:inline-flex")}
      >
        {shopContent.filters.button}
        <Settings2Icon aria-hidden className="size-5" />
        <span className="sr-only">{open ? "(hide filters)" : "(show filters)"}</span>
      </button>
      <aside
        id={asideId}
        aria-label={shopContent.filters.sheetTitle}
        className="hidden flex-col gap-6 [grid-area:aside] laptop:flex laptop:group-data-[sidebar=closed]/shop:hidden"
      >
        {sidebar}
      </aside>
      {children}
    </div>
  );
}
