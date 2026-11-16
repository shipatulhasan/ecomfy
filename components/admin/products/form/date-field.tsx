"use client";

import { CalendarIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dhakaDateKey, dhakaMidnight, formatDhaka } from "@/lib/admin/date-range";
import { cn } from "@/lib/utils";
import { fieldInput } from "./fields";

const DAY = 86_400_000;
const keyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const localDate = (key: string) => {
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

/**
 * Add Product "Expiration" Start / End. Days are Asia/Dhaka calendar days: Start
 * = that day's 00:00, End = the end of that day (stored as the next midnight).
 */
export function DateField({
  id,
  value,
  onChange,
  placeholder,
  edge,
  invalid,
  disabled,
}: {
  id: string;
  value: string | null | undefined;
  onChange: (iso: string | null) => void;
  placeholder: string;
  edge: "start" | "end";
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const shownKey = value ? dhakaDateKey(+new Date(value) - (edge === "end" ? 1 : 0)) : null;

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            data-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-invalid` : undefined}
            className={cn(fieldInput, "data-invalid:border-destructive flex items-center justify-between bg-card text-left shadow-none", !shownKey && "text-foreground")}
          >
            {shownKey ? formatDhaka(dhakaMidnight(shownKey), "dd MMM yyyy") : placeholder}
            <CalendarIcon aria-hidden className="size-5 stroke-[1.5]" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={shownKey ? localDate(shownKey) : undefined}
            defaultMonth={shownKey ? localDate(shownKey) : undefined}
            onSelect={(d) => {
              if (!d) return onChange(null);
              const start = dhakaMidnight(keyOf(d));
              onChange(new Date(+start + (edge === "end" ? DAY : 0)).toISOString());
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {invalid && (
        <span id={`${id}-invalid`} className="sr-only">
          Check this date
        </span>
      )}
      {shownKey && !disabled && (
        <button
          type="button"
          aria-label={`Clear ${placeholder.toLowerCase()} date`}
          onClick={() => onChange(null)}
          className="tap-target absolute top-1/2 right-10 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <XIcon aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
