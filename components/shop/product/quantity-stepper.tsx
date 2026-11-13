"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** "− 5 +" pill (Figma "Quantity" 124×50). Controlled; buttons disable at the bounds. */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  compact,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
  disabled?: boolean;
  /** Narrower value cell (pinned mobile bar). */
  compact?: boolean;
  className?: string;
}) {
  const button =
    "press grid size-8.5 shrink-0 place-items-center rounded-full bg-muted-strong text-foreground tap-target hover:bg-border disabled:opacity-40 disabled:hover:bg-muted-strong";
  return (
    <div
      role="group"
      aria-label="Quantity"
      className={cn("inline-flex h-12.5 shrink-0 items-center rounded-full border border-border bg-background p-0.75 laptop:p-2", className)}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={button}
      >
        <MinusIcon aria-hidden className="size-3.5" />
      </button>
      <output aria-live="polite" aria-label={`Quantity ${value}`} className={cn("text-center text-lead text-foreground", compact ? "w-8 tablet:w-10" : "w-10")}>
        {value}
      </output>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={button}
      >
        <PlusIcon aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}
