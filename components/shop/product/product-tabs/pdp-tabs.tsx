"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PDP_TABS, parsePdpTab, pdpCopy, type PdpTab } from "@/lib/config/product";
import { cn } from "@/lib/utils";
import { PDP_TAB_EVENT } from "./tab-events";

/**
 * Tab switcher for the three PDP panels. Every panel is rendered on the server and
 * passed in (all of them are in the HTML: description and specs are indexable).
 * This leaf only toggles visibility (forceMount + `hidden`), so switching is
 * instant with no request. The active tab is mirrored to `?tab=` with
 * history.replaceState (no navigation; the default tab is dropped from the URL).
 *
 * - Laptop+: the PNG nav: centered text tabs on a full-bleed bottom border, the
 *   active one dark with a 2px primary underline.
 * - Below laptop: a sticky segmented control under the compact header, with
 *   shorter labels. It scrolls sideways if the labels ever don't fit.
 */
export function PdpTabs({
  initialTab,
  reviewCount,
  panels,
}: {
  initialTab: PdpTab;
  reviewCount: number;
  panels: Record<PdpTab, React.ReactNode>;
}) {
  const [tab, setTab] = useState(initialTab);
  // A soft navigation to this page with another ?tab= re-renders with a new initial tab.
  const [prevInitial, setPrevInitial] = useState(initialTab);
  if (initialTab !== prevInitial) {
    setPrevInitial(initialTab);
    setTab(initialTab);
  }

  function select(next: PdpTab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === PDP_TABS[0]) url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    url.hash = "";
    window.history.replaceState(null, "", url);
  }

  // "4 Review" link in the info column (ReviewsLink) switches tabs in place.
  useEffect(() => {
    const onTab = (e: Event) => select(parsePdpTab((e as CustomEvent<unknown>).detail));
    window.addEventListener(PDP_TAB_EVENT, onTab);
    return () => window.removeEventListener(PDP_TAB_EVENT, onTab);
  }, []);

  return (
    <Tabs value={tab} onValueChange={(v) => select(parsePdpTab(v))} className="gap-0">
      <div className="sticky top-(--app-header-h) z-20 border-b border-border bg-background/90 px-safe-gutter py-2 backdrop-blur-md laptop:static laptop:bg-background laptop:p-0 laptop:backdrop-blur-none">
        <TabsList
          aria-label={pdpCopy.tabsLabel}
          className={cn(
            // Segmented control (mobile/tablet)
            "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            // PNG nav (laptop+): 56 high, centered, no track
            "laptop:h-14 laptop:justify-center laptop:gap-0 laptop:overflow-visible laptop:rounded-none laptop:bg-transparent laptop:p-0",
          )}
        >
          {PDP_TABS.map((value) => {
            const t = pdpCopy.tabs[value];
            return (
              <TabsTrigger
                key={value}
                value={value}
                className={cn(
                  // Segment: equal widths, pill when active. Font sizes use the length form
                  // so the vendored cn() keeps them (it doesn't know our text-* tokens).
                  "h-auto flex-1 shrink-0 rounded-full border-0 px-3 py-2 text-(length:--text-copy) leading-(--text-copy--line-height) font-medium text-text-body data-active:bg-background data-active:text-foreground data-active:shadow-sm",
                  // Laptop+: text tab with the primary underline flush with the border.
                  "laptop:h-full laptop:flex-none laptop:rounded-none laptop:px-4 laptop:py-0 laptop:text-(length:--text-lead) laptop:leading-(--text-lead--line-height) laptop:font-normal laptop:text-muted-foreground laptop:hover:text-foreground laptop:data-active:bg-transparent laptop:data-active:font-medium laptop:data-active:text-foreground laptop:data-active:shadow-none laptop:group-data-[variant=default]/tabs-list:data-active:shadow-none",
                  "after:bg-primary group-data-horizontal/tabs:after:-bottom-px group-data-horizontal/tabs:after:h-0.5 laptop:data-active:after:opacity-100",
                )}
              >
                <span className="laptop:hidden">
                  {t.short}
                  {value === "reviews" && reviewCount > 0 && <span className="text-muted-foreground"> ({reviewCount})</span>}
                </span>
                <span className="hidden laptop:inline">{t.label}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>
      {PDP_TABS.map((value) => (
        <TabsContent
          key={value}
          value={value}
          forceMount
          hidden={tab !== value}
          className="text-(length:--text-copy) leading-(--text-copy--line-height) focus-visible:outline-none"
        >
          {panels[value]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
