"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { dhakaDateKey, type RangeKey, rangeHref } from "@/lib/admin/date-range";
import { cn } from "@/lib/utils";

const PRESETS: { key: Exclude<RangeKey, "custom">; label: string }[] = [
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

/**
 * The KPI cards' "Last 7 days" label (Dashboard.png) doubles as the dashboard's
 * date range control: same quiet text, a small chevron, and a popover with the
 * presets and a custom from–to. Writes ?range=7d|30d|90d|custom&from&to.
 */
export function RangeMenu({ current, label, from, to }: { current: RangeKey; label: string; from: string; to: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState({ from, to });
  const today = dhakaDateKey();
  const validCustom = custom.from && custom.to && custom.from <= custom.to && custom.to <= today;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="tap-target -mr-1 inline-flex shrink-0 items-center gap-0.5 rounded-md px-1 text-caption text-muted-foreground hover:text-foreground"
        aria-label={`Date range: ${label}. Change`}
      >
        {label}
        <ChevronDownIcon aria-hidden className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <ul className="flex flex-col">
          {PRESETS.map((p) => (
            <li key={p.key}>
              <Link
                href={rangeHref(pathname, new URLSearchParams(params), { range: p.key })}
                scroll={false}
                onClick={() => setOpen(false)}
                className="flex h-9 items-center justify-between rounded-md px-2 text-copy text-foreground hover:bg-secondary"
              >
                {p.label}
                {current === p.key && <CheckIcon aria-hidden className="size-4 text-primary" />}
              </Link>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex flex-col gap-2 border-t border-border px-2 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!validCustom) return;
            setOpen(false);
            router.push(rangeHref(pathname, new URLSearchParams(params), { range: "custom", ...custom }), { scroll: false });
          }}
        >
          <p className="text-caption font-bold text-foreground">Custom range</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-caption text-muted-foreground">
              From
              <input
                type="date"
                value={custom.from}
                max={today}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                className="h-9 rounded-md border border-border bg-card px-2 text-caption text-foreground"
              />
            </label>
            <label className="flex flex-col gap-1 text-caption text-muted-foreground">
              To
              <input
                type="date"
                value={custom.to}
                max={today}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                className="h-9 rounded-md border border-border bg-card px-2 text-caption text-foreground"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={!validCustom}
            className={cn(
              "h-9 rounded-md bg-primary text-caption font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-50",
              current === "custom" && "ring-2 ring-primary/30",
            )}
          >
            Apply
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
