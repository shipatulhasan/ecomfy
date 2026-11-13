import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Below laptop, checkout is stacked steps (1 Address → 2 Delivery → 3 Payment):
 * collapsible cards that show a one-line summary once completed. From laptop the
 * step chrome is hidden and every body is always shown, so the layout is the
 * Checkout.png form. Pure CSS: `data-open` only matters below laptop.
 */
export function CheckoutStep({
  index,
  title,
  open,
  done,
  summary,
  onEdit,
  className,
  children,
}: {
  index: number;
  title: string;
  open: boolean;
  done: boolean;
  summary?: React.ReactNode;
  onEdit: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  const bodyId = `checkout-step-${index}`;
  return (
    <section
      aria-labelledby={`${bodyId}-title`}
      className={cn("rounded-lg border border-border bg-card p-4 tablet:p-6 laptop:rounded-none laptop:border-0 laptop:bg-transparent laptop:p-0", className)}
    >
      <header className="flex items-center gap-3 laptop:hidden">
        <span
          aria-hidden
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-full text-caption font-semibold",
            done || open ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {done && !open ? <CheckIcon className="size-4" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${bodyId}-title`} className="text-h4 font-medium text-foreground">
            {title}
          </h2>
          {done && !open && summary && <p className="truncate text-caption text-muted-foreground">{summary}</p>}
        </div>
        {done && !open && (
          <button
            type="button"
            onClick={onEdit}
            aria-controls={bodyId}
            aria-expanded={false}
            className="press tap-target text-copy font-semibold text-primary"
          >
            Edit
          </button>
        )}
      </header>
      <div id={bodyId} data-open={open} className="mt-4 data-[open=false]:hidden laptop:mt-0 laptop:block!">
        {children}
      </div>
    </section>
  );
}
