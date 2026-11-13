"use client";

import { useSyncExternalStore } from "react";

/**
 * Review date as in the PNG: "2 min ago" for recent reviews, "30 Apr, 2021" after
 * a week. Relative times need the viewer's clock, so the server (and hydration)
 * render the absolute UTC date; the client switches to the relative text after
 * hydrating and refreshes it every minute. No Date.now() in server/cached code.
 */
const RELATIVE_FOR_MS = 7 * 86_400_000;
const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto", style: "short" }) // "2 min ago";
const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function absolute(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")}, ${get("year")}`;
}

function relative(date: Date, now: number) {
  const diff = date.getTime() - now;
  if (-diff > RELATIVE_FOR_MS) return absolute(date);
  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.min(-1, Math.round(diff / 60_000)), "minute"); // "1 min ago", never "now"
}

const subscribe = (cb: () => void) => {
  const id = window.setInterval(cb, 60_000);
  return () => window.clearInterval(id);
};

export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const date = new Date(iso);
  const text = useSyncExternalStore(
    subscribe,
    () => relative(date, Date.now()),
    () => absolute(date, "UTC"),
  );
  return (
    <time dateTime={iso} title={absolute(date)} suppressHydrationWarning className={className}>
      {text}
    </time>
  );
}
