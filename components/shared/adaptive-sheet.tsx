"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { BottomSheet } from "./bottom-sheet";

/**
 * A bottom sheet below laptop and a right side sheet from laptop up (mini cart,
 * quick view, …). It renders the trigger twice and switches between them with CSS,
 * so there's no width detection (CLAUDE.md). Content is only mounted while open, so
 * passing the same children to both costs nothing.
 */
export function AdaptiveSheet({
  trigger,
  title,
  description,
  footer,
  sideClassName = "w-full tablet:max-w-114",
  children,
}: {
  /** Rendered twice (asChild). Don't put ids on it. */
  trigger: React.ReactElement;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  /** Width of the laptop+ side sheet (defaults to the 456px cart drawer). */
  sideClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span className="contents laptop:hidden">
        <BottomSheet trigger={trigger} title={title} description={description} footer={footer}>
          {children}
        </BottomSheet>
      </span>
      <span className="hidden laptop:contents">
        <Sheet>
          <SheetTrigger asChild>{trigger}</SheetTrigger>
          <SheetContent side="right" className={cn("gap-0 p-0", sideClassName)}>
            <SheetHeader className="border-b border-border px-6 py-4">
              <SheetTitle className="text-h4">{title}</SheetTitle>
              <SheetDescription className={description ? "text-copy" : "sr-only"}>
                {description ?? title}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
            {footer && <div className="border-t border-border px-6 py-4">{footer}</div>}
          </SheetContent>
        </Sheet>
      </span>
    </>
  );
}
