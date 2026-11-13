import { cn } from "@/lib/utils";

/**
 * The screen's primary action pinned above the tab bar below laptop (PDP "Add to
 * cart", cart "Checkout", …). Laptop+ shows the action inline as in the PNG, so the
 * bar is `laptop:hidden`. Render the inline version separately.
 *
 * Positioned with the app-shell variables (app/globals.css). It sits on the tab bar,
 * or on the home indicator when there is no tab bar (checkout). An in-flow spacer of
 * the same height keeps the end of the page from being covered.
 */
export function StickyActionBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-18 laptop:hidden" />
      <div
        data-slot="sticky-action-bar"
        className={cn(
          "fixed inset-x-0 bottom-(--app-bottom-nav) z-30 border-t border-border bg-background/85 pb-(--app-bottom-safe) backdrop-blur-md laptop:hidden",
          className,
        )}
      >
        <div className="flex h-18 items-center gap-3 px-safe-gutter">{children}</div>
      </div>
    </>
  );
}
