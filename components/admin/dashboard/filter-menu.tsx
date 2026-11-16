"use client";

import { CheckIcon, ListFilterIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Green "Filter ≡" button (Transaction, Best selling) → options written to one URL param. */
export function FilterMenu({
  param,
  label,
  options,
  value,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  value: string;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const href = (v: string) => {
    const p = new URLSearchParams(params);
    if (v === options[0]?.value) p.delete(param);
    else p.set(param, v);
    const qs = p.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="press inline-flex h-8 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-copy text-primary-foreground hover:bg-primary-hover">
        Filter
        <ListFilterIcon aria-hidden className="size-5" />
        {value !== options[0]?.value && <span className="sr-only">(active)</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-56">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        {options.map((o) => (
          <DropdownMenuItem key={o.value} asChild>
            <Link href={href(o.value)} scroll={false} className="justify-between">
              {o.label}
              {value === o.value && <CheckIcon aria-hidden className="text-primary" />}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
