"use client";

import { Settings2Icon } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { shopContent } from "@/lib/config/shop";
import { cn } from "@/lib/utils";

/** The design's green "Filter" pill (131×45). */
export const FILTER_PILL =
  "inline-flex h-11.25 shrink-0 items-center gap-3 rounded-full bg-primary px-6 text-copy font-semibold text-primary-foreground transition-colors hover:bg-brand-dark";

/**
 * Below laptop: the "Filter" pill opens a left Sheet with the same <FilterPanel>
 * as the sidebar (passed in from the server). Filters apply as you tap; the
 * results update behind the sheet.
 */
export function FilterSheet({ children, className }: { children: React.ReactNode; className?: string }) {
  const t = shopContent.filters;
  return (
    <Sheet>
      <SheetTrigger className={cn(FILTER_PILL, "laptop:hidden", className)}>
        {t.button}
        <Settings2Icon aria-hidden className="size-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-80 max-w-[85vw] gap-0 p-0">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="text-h4">{t.sheetTitle}</SheetTitle>
          <SheetDescription className="sr-only">Filter the product list</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6">{children}</div>
        <SheetFooter className="border-t border-border px-6 py-4">
          <SheetClose className={cn(FILTER_PILL, "w-full justify-center")}>{t.showResults}</SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
