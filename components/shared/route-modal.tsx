"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

/**
 * Modal for an intercepted route (`@modal/(.)…/page.tsx`). Closing it (X, overlay,
 * Esc, swipe) goes back in history, so the URL is shareable and the back button
 * closes it.
 *
 * One component for every width, with no width detection:
 * - below laptop: an app-style bottom sheet (up to 90dvh) with a drag handle;
 *   swiping it down closes the modal;
 * - laptop+: a centered dialog, with the close X outside the panel (top-right) and
 *   no dragging (the handle is hidden, and dragging is handle-only). It is at most
 *   100dvh − 4rem tall and centered in the viewport minus 3.5rem on top, so the X
 *   above it stays on screen at full height.
 *
 * Built on vaul (what shadcn Drawer wraps), so Radix Dialog supplies the focus trap,
 * Esc, `role="dialog"` and the title/description. vaul injects unlayered CSS, so
 * the laptop animation, the handle look and the reduced-motion rules live in
 * app/globals.css (`[data-slot="route-modal"]`).
 *
 * Children own the layout: a scroll area plus an optional pinned footer.
 */
export function RouteModal({
  title,
  description,
  className,
  children,
}: {
  /** Accessible dialog name (visually hidden). */
  title: string;
  description: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const left = useRef(false);

  // Next keeps visited routes alive in a hidden <Activity>, so reopening the same URL
  // reveals this instance instead of mounting a new one. Effects are torn down when
  // it's hidden: reset there, so a revealed modal opens again.
  useEffect(
    () => () => {
      left.current = false;
      setOpen(true);
    },
    [],
  );

  return (
    <Drawer.Root
      open={open}
      onOpenChange={setOpen}
      // Called after vaul's exit animation; then leave the intercepted URL.
      onAnimationEnd={(isOpen) => {
        if (isOpen || left.current) return;
        left.current = true;
        router.back();
      }}
      handleOnly
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay data-slot="route-modal-overlay" className="fixed inset-0 z-50 bg-overlay" />
        <Drawer.Content
          data-slot="route-modal"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-xl bg-background text-foreground outline-none",
            "laptop:inset-x-0 laptop:top-14 laptop:bottom-2 laptop:m-auto laptop:h-fit laptop:max-h-[calc(100dvh-4rem)] laptop:w-[min(82.5rem,calc(100%-4rem))] laptop:rounded-lg laptop:shadow-modal",
            className,
          )}
        >
          <Drawer.Handle aria-label="Drag down to close" />
          <Drawer.Title className="sr-only">{title}</Drawer.Title>
          <Drawer.Description className="sr-only">{description}</Drawer.Description>
          <Drawer.Close
            aria-label="Close"
            className={cn(
              "press absolute top-2 right-2 z-20 grid size-11 place-items-center rounded-full bg-background/85 text-foreground backdrop-blur-sm",
              "laptop:-top-13 laptop:right-0 laptop:bg-transparent laptop:text-primary-foreground laptop:backdrop-blur-none laptop:hover:opacity-80",
            )}
          >
            <XIcon aria-hidden className="size-6 stroke-[1.5]" />
          </Drawer.Close>
          {children}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
