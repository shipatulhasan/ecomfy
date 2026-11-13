"use client";

import { useState } from "react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

/**
 * App-style bottom sheet (vaul Drawer with a drag handle). Use it below laptop for
 * filters, sort, variant pickers and the mini cart, instead of side sheets or modals.
 * The body scrolls and the footer clears the home indicator (bottom safe area).
 *
 * `trigger` is rendered as-is (asChild), so give it its own `laptop:hidden` when the
 * laptop layout uses something else. For "bottom sheet below laptop, side sheet
 * above", use <AdaptiveSheet>.
 */
export function BottomSheet({
  trigger,
  title,
  description,
  footer,
  closeOnLink = false,
  open: controlledOpen,
  onOpenChange,
  className,
  children,
}: {
  trigger: React.ReactElement;
  title: React.ReactNode;
  /** Shown under the title. Without it, the title doubles as the screen-reader description. */
  description?: React.ReactNode;
  footer?: React.ReactNode;
  /** Close when a link inside is followed (e.g. a sort option). */
  closeOnLink?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  const onClickCapture = closeOnLink
    ? (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest("a[href]")) setOpen(false);
      }
    : undefined;

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent
        className={cn("max-h-[85dvh] pb-[env(safe-area-inset-bottom)]", className)}
        onClickCapture={onClickCapture}
      >
        <DrawerHeader className="px-gutter pt-3 pb-2 text-left">
          <DrawerTitle className="text-h4 text-foreground">{title}</DrawerTitle>
          {description ? (
            <DrawerDescription className="text-copy text-muted-foreground">{description}</DrawerDescription>
          ) : (
            <DrawerDescription className="sr-only">{title}</DrawerDescription>
          )}
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter pb-4">{children}</div>
        {footer && <DrawerFooter className="border-t border-border px-gutter py-3">{footer}</DrawerFooter>}
      </DrawerContent>
    </Drawer>
  );
}

/** Wrap a button in the sheet's footer/body to close it ("Show 52 results"). */
export const BottomSheetClose = DrawerClose;
