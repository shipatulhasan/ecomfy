"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { productCopy } from "@/lib/config/product";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string; stock: number };

/**
 * Size / weight / colour picker for products with 2+ variants (not in the design;
 * sits above the quantity row). Nothing is preselected, so Add to Cart stays disabled
 * until the shopper chooses. Sold-out options are disabled.
 */
export function VariantSelector({
  options,
  value,
  onChange,
  className,
}: {
  options: Option[];
  value: string | null;
  onChange: (id: string) => void;
  className?: string;
}) {
  const labelId = useId();
  if (options.length < 2) return null;
  const selected = options.find((o) => o.id === value);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p id={labelId} className="text-copy">
        <span className="font-medium text-foreground">{productCopy.option}: </span>
        <span className={selected ? "text-text-body" : "text-muted-foreground"}>
          {selected?.name ?? productCopy.chooseOption}
        </span>
      </p>
      <RadioGroup
        aria-labelledby={labelId}
        value={value ?? ""}
        onValueChange={onChange}
        className="flex flex-wrap gap-2"
      >
        {options.map((o) => (
          <Label
            key={o.id}
            className={cn(
              "press h-10 cursor-pointer rounded-full border border-border px-4 text-copy font-normal text-foreground tap-target",
              "hover:border-primary has-data-checked:border-primary has-data-checked:bg-secondary has-data-checked:text-brand-dark",
              "has-disabled:cursor-not-allowed has-disabled:opacity-50 has-disabled:line-through",
            )}
          >
            <RadioGroupItem value={o.id} disabled={o.stock <= 0} />
            {o.name}
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}
