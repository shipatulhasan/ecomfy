"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

/**
 * Live "DAYS : HOURS : MINS : SECS" countdown.
 * `endsAt` (ISO) or `mode="end-of-month"` (viewer's local month end).
 * Server render and first paint show "--" so hydration never mismatches.
 */
type Props = {
  endsAt?: string | null;
  mode?: "end-of-month";
  tone?: "default" | "inverse";
  size?: "sm" | "md";
  className?: string;
};

const subscribe = (tick: () => void) => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
};
const nowSeconds = () => Math.floor(Date.now() / 1000);
const serverNow = () => null;

/** End time in epoch seconds. Only called with the client clock (never during prerender). */
function target(nowSec: number, endsAt: Props["endsAt"], mode: Props["mode"]): number | null {
  if (mode === "end-of-month") {
    const now = new Date(nowSec * 1000);
    return Math.floor(new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() / 1000);
  }
  return endsAt ? Math.floor(Date.parse(endsAt) / 1000) : null;
}

export function CountdownTimer({ endsAt, mode, tone = "default", size = "md", className }: Props) {
  const now = useSyncExternalStore(subscribe, nowSeconds, serverNow);
  const end = now === null ? null : target(now, endsAt, mode);
  const left = now === null || end === null ? null : Math.max(0, end - now);
  const parts: [string, number | null][] = [
    ["Days", left === null ? null : Math.floor(left / 86_400)],
    ["Hours", left === null ? null : Math.floor((left % 86_400) / 3600)],
    ["Mins", left === null ? null : Math.floor((left % 3600) / 60)],
    ["Secs", left === null ? null : left % 60],
  ];

  return (
    <div
      role="timer"
      aria-label={left === null ? "Offer countdown" : `Offer ends in ${parts.map(([l, v]) => `${v} ${l}`).join(", ")}`}
      className={cn("flex items-start justify-center", size === "md" ? "gap-3" : "gap-2", className)}
    >
      {parts.map(([label, value], i) => (
        <div key={label} className="contents">
          {i > 0 && (
            <span
              aria-hidden
              className={cn(
                size === "md" ? "text-h4 font-normal" : "text-lead",
                tone === "inverse" ? "text-primary-foreground/60" : "text-muted-foreground",
              )}
            >
              :
            </span>
          )}
          <div className="flex min-w-10 flex-col items-center" aria-hidden>
            <span
              // Re-mount on change so each new value slides in.
              key={value ?? "init"}
              className={cn(
                "tabular-nums motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 motion-safe:duration-300",
                size === "md" ? "text-h3 font-normal" : "text-h4 font-medium",
                tone === "inverse" ? "text-primary-foreground" : "text-foreground",
              )}
            >
              {value === null ? "--" : String(value).padStart(2, "0")}
            </span>
            <span
              className={cn(
                "text-[0.625rem] uppercase tracking-wider",
                tone === "inverse" ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
