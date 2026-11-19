"use client";

import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * A form modal: a full-height bottom sheet below laptop and a centered dialog
 * from laptop up (`placement="right"`: a full-height right side sheet instead,
 * for URL-driven detail panels like the admin Transaction sheet). One Radix Dialog styled per layer with CSS (no width
 * detection, CLAUDE.md), so URL-driven opening (?edit=…) works on a fresh load.
 *
 * The header and footer stay put; only the body scrolls (laptop+: the dialog
 * caps at 80dvh). Esc / overlay / ✕ call `onOpenChange(false)`; the caller
 * decides (e.g. an unsaved-changes confirm) and keeps `open` controlled.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  placement = "center",
  children,
}: {
  placement?: "center" | "right";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  /** Laptop+ width, e.g. `laptop:max-w-140`. */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          data-slot="dialog-overlay"
          className="fixed inset-0 z-50 bg-foreground/30 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Content
          data-slot="responsive-modal"
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden bg-card text-foreground shadow-lg outline-none",
            // Below laptop: full-height bottom sheet (rounded top, clears the status bar).
            "inset-x-0 bottom-0 h-[calc(100dvh-env(safe-area-inset-top)-0.75rem)] rounded-t-2xl duration-200",
            "data-open:animate-in data-open:slide-in-from-bottom-10 data-open:fade-in-0 data-closed:animate-out data-closed:slide-out-to-bottom-10 data-closed:fade-out-0",
            placement === "center"
              ? [
                  // Laptop+: centered dialog.
                  "laptop:inset-auto laptop:top-1/2 laptop:left-1/2 laptop:h-auto laptop:max-h-[80dvh] laptop:w-[calc(100%-4rem)] laptop:-translate-x-1/2 laptop:-translate-y-1/2 laptop:rounded-xl",
                  "laptop:data-open:slide-in-from-bottom-0 laptop:data-open:zoom-in-95 laptop:data-closed:slide-out-to-bottom-0 laptop:data-closed:zoom-out-95",
                ]
              : [
                  // Laptop+: full-height right side sheet.
                  "laptop:inset-y-0 laptop:right-0 laptop:left-auto laptop:h-full laptop:w-full laptop:rounded-none laptop:border-l laptop:border-border",
                  "laptop:data-open:slide-in-from-bottom-0 laptop:data-open:slide-in-from-right-10 laptop:data-closed:slide-out-to-bottom-0 laptop:data-closed:slide-out-to-right-10",
                ],
            className,
          )}
        >
          <span aria-hidden className="mx-auto mt-2 h-1 w-12 shrink-0 rounded-full bg-border laptop:hidden" />
          <header className="flex shrink-0 items-start gap-3 border-b border-border px-gutter py-4 laptop:px-6">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogPrimitive.Title className="text-h1 text-foreground">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className={description ? "text-copy text-muted-foreground" : "sr-only"}>
                {description ?? title}
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="tap-target -mt-1 -mr-2 grid size-9 shrink-0 place-items-center rounded-md text-text-body transition-colors hover:bg-muted hover:text-foreground">
              <XIcon aria-hidden className="size-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter py-5 laptop:px-6">{children}</div>
          {footer && (
            <footer className="shrink-0 border-t border-border px-gutter pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] laptop:px-6 laptop:py-4">
              {footer}
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
