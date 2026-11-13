"use client";

import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** The round ✕ on cart / wishlist rows (Figma "Close" 24 / 28px, grey ring). */
export function RemoveButton({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "press tap-target grid size-6 shrink-0 place-items-center rounded-full border border-border text-foreground transition-colors hover:border-sale hover:text-sale disabled:opacity-40",
        className,
      )}
    >
      <XIcon aria-hidden className="size-3.5" />
    </button>
  );
}
