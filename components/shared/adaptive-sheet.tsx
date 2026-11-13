"use client";

import { useState } from "react";
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
  open,
  onOpenChange,
  children,
}: {
  /** Rendered twice (asChild). Don't put ids on it. */
  trigger: React.ReactElement;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  /** Width of the laptop+ side sheet (defaults to the 456px cart drawer). */
  sideClassName?: string;
  /** Controlled open state (e.g. close after an async submit). Shared by both sheets. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}) {
  // Controlled: only the sheet whose trigger was used opens (both are portalled, so
  // the CSS that hides the other trigger doesn't hide its content).
  const [which, setWhich] = useState<"bottom" | "side">("bottom");
  const handle = (kind: "bottom" | "side") => (next: boolean) => {
    if (!next && open && which !== kind) return; // the other (closed) sheet reporting "closed"
    if (next) setWhich(kind);
    onOpenChange?.(next);
  };
  const isOpen = (kind: "bottom" | "side") => (open === undefined ? undefined : open && which === kind);

  return (
    <>
      <span className="contents laptop:hidden">
        <BottomSheet trigger={trigger} title={title} description={description} footer={footer} open={isOpen("bottom")} onOpenChange={onOpenChange && handle("bottom")}>
          {children}
        </BottomSheet>
      </span>
      <span className="hidden laptop:contents">
        <Sheet open={isOpen("side")} onOpenChange={onOpenChange && handle("side")}>
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
