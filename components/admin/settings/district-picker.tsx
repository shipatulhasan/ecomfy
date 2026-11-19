"use client";

import { CheckIcon, ChevronsUpDownIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { fieldInput } from "@/components/admin/products/form/fields";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DISTRICTS } from "@/lib/config/districts";
import { cn } from "@/lib/utils";

/** Multi-select of the 64 districts (shipping zones, COD allowed districts): searchable list + removable chips. */
export function DistrictPicker({
  id,
  value,
  onChange,
  placeholder = "Choose districts",
  disabledOptions = [],
  invalid,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  /** Taken by another zone: shown but not selectable. */
  disabledOptions?: string[];
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 12;
  const shown = showAll ? value : value.slice(0, LIMIT);
  const toggle = (d: string) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          aria-invalid={invalid || undefined}
          className={cn(fieldInput, "flex items-center justify-between gap-2 text-left text-lead", value.length === 0 && "text-muted-foreground")}
        >
          <span className="truncate">{value.length ? `${value.length} district${value.length === 1 ? "" : "s"}` : placeholder}</span>
          <ChevronsUpDownIcon aria-hidden className="size-4 shrink-0 text-text-body" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
          <Command>
            <CommandInput placeholder="Search districts" />
            <CommandList className="max-h-72">
              <CommandEmpty>No district found.</CommandEmpty>
              <CommandGroup>
                {DISTRICTS.map((d) => {
                  const taken = disabledOptions.includes(d) && !value.includes(d);
                  return (
                    <CommandItem key={d} value={d} disabled={taken} onSelect={() => toggle(d)}>
                      <CheckIcon aria-hidden className={cn("size-4", value.includes(d) ? "opacity-100" : "opacity-0")} />
                      {d}
                      {taken && <span className="ml-auto text-caption text-muted-foreground">other zone</span>}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((d) => (
            <li key={d}>
              <button
                type="button"
                onClick={() => toggle(d)}
                aria-label={`Remove ${d}`}
                className="press inline-flex h-7 items-center gap-1 rounded-full bg-secondary px-2.5 text-caption text-secondary-foreground hover:bg-muted"
              >
                {d} <XIcon aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
          {value.length > LIMIT && (
            <li>
              <button type="button" onClick={() => setShowAll((v) => !v)} className="tap-target inline-flex h-7 items-center rounded-full px-2.5 text-caption font-bold text-primary hover:bg-secondary">
                {showAll ? "Show less" : `+${value.length - LIMIT} more`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
