"use client";

import { CheckIcon, ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCategoryInline } from "@/lib/actions/admin-products";
import { cn } from "@/lib/utils";

/** Add Products.png dropdown look: 48 high, white, soft shadow, ▼ on the right. */
export const dropdownClass =
  "flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 text-lead text-foreground shadow-sm outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive disabled:opacity-60";

type Category = { id: string; name: string };

/** Product Categories select + "+ Add category" (categories:create) inline. */
export function CategoryPicker({
  id,
  value,
  onChange,
  categories,
  onCategoryAdded,
  canAdd,
  invalid,
  describedBy,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (id: string) => void;
  categories: Category[];
  onCategoryAdded: (c: Category) => void;
  canAdd: boolean;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      const res = await createCategoryInline({ name });
      if (!res.ok) return void toast.error(res.fieldErrors?.name?.[0] ?? res.error);
      onCategoryAdded(res.data);
      onChange(res.data.id);
      setAdding(false);
      setName("");
      toast.success(`Category “${res.data.name}” ready`);
    });

  return (
    <div className="flex flex-col gap-2">
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-invalid={invalid || undefined} aria-describedby={describedBy} className={cn(dropdownClass, "data-[size=default]:h-12")}>
          <SelectValue placeholder="Select your product" />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-72">
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {canAdd &&
        !disabled &&
        (adding ? (
          <div className="flex gap-2">
            <label htmlFor={`${id}-new`} className="sr-only">
              New category name
            </label>
            <input
              id={`${id}-new`}
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (name.trim()) add();
                }
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="New category name"
              className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-copy outline-none focus-visible:border-primary"
            />
            <button type="button" disabled={pending || !name.trim()} onClick={add} className="h-10 rounded-lg bg-primary px-3 text-copy font-medium text-primary-foreground disabled:opacity-50">
              {pending ? "Adding…" : "Add"}
            </button>
            <button type="button" aria-label="Cancel" onClick={() => setAdding(false)} className="tap-target grid size-10 place-items-center rounded-lg hover:bg-muted">
              <XIcon aria-hidden className="size-4" />
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="tap-target inline-flex items-center gap-1 self-start text-copy font-medium text-primary hover:underline">
            <PlusIcon aria-hidden className="size-4" /> Add category
          </button>
        ))}
    </div>
  );
}

/**
 * Creatable combobox (cmdk): tags (multiple) and brand (single). Typing a value
 * that isn't listed offers “Create …”.
 */
export function CreatableSelect({
  id,
  multiple,
  value,
  onChange,
  options,
  placeholder,
  noun,
  invalid,
  disabled,
}: {
  id: string;
  multiple?: boolean;
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder: string;
  noun: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const all = [...new Set([...options, ...value])].sort((a, b) => a.localeCompare(b));
  const term = search.trim();
  const exists = all.some((o) => o.toLowerCase() === term.toLowerCase());

  const pick = (v: string) => {
    if (multiple) onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else {
      onChange(value[0] === v ? [] : [v]);
      setOpen(false);
    }
    setSearch("");
  };

  return (
    <div className="flex flex-col gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button id={id} type="button" aria-haspopup="listbox" data-invalid={invalid || undefined} className={cn(dropdownClass, "data-invalid:border-destructive")}>
            <span className={cn("truncate", value.length === 0 && "text-foreground")}>
              {value.length === 0 ? placeholder : multiple ? `${value.length} ${noun}${value.length === 1 ? "" : "s"} selected` : value[0]}
            </span>
            <ChevronDownIcon aria-hidden className="size-5 shrink-0 fill-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
          <Command>
            <CommandInput value={search} onValueChange={setSearch} placeholder={`Search or create a ${noun}…`} maxLength={40} />
            <CommandList>
              <CommandEmpty>{term ? null : `No ${noun}s yet.`}</CommandEmpty>
              {term && !exists && (
                <CommandGroup>
                  <CommandItem value={`__create ${term}`} onSelect={() => pick(term)}>
                    <PlusIcon aria-hidden /> Create “{term}”
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                {all.map((o) => (
                  <CommandItem key={o} value={o} onSelect={() => pick(o)}>
                    <CheckIcon aria-hidden className={cn(!value.includes(o) && "invisible")} />
                    {o}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {multiple && value.length > 0 && (
        <ul aria-label={`Selected ${noun}s`} className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v} className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-caption font-medium text-secondary-foreground">
              {v}
              {!disabled && (
                <button type="button" aria-label={`Remove ${v}`} onClick={() => pick(v)} className="tap-target grid size-5 place-items-center rounded-full hover:bg-accent">
                  <XIcon aria-hidden className="size-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
