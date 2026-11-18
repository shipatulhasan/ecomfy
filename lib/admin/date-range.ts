/**
 * Admin date ranges, in Asia/Dhaka (UTC+6 all year, no DST, so fixed-offset math
 * is exact). Ranges are whole Dhaka days, `[start, end)` as UTC instants, and the
 * ISO strings double as cache keys for the `"use cache"` dashboard queries.
 *
 * Pure: usable from server and client code.
 */
export const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CUSTOM_DAYS = 366;

export const RANGE_KEYS = ["7d", "30d", "90d", "custom"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];
export const DEFAULT_RANGE: RangeKey = "7d"; // matches the PNG's "Last 7 days"

export type DateRange = {
  key: RangeKey;
  /** Inclusive Dhaka calendar dates, YYYY-MM-DD. */
  from: string;
  to: string;
  days: number;
  /** UTC instants: [start, end) and the previous period of the same length. */
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  /** "Last 7 days" / "3 Oct – 12 Oct". */
  label: string;
  /** "Previous 7days" (PNG wording) / "Previous period". */
  prevLabel: string;
};

/** YYYY-MM-DD of the Dhaka calendar day an instant falls on. */
export function dhakaDateKey(instant: Date | number = Date.now()): string {
  return new Date(+instant + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant of Dhaka midnight starting `dateKey`. */
export function dhakaMidnight(dateKey: string): Date {
  const [y, m, d] = dateKey.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d) - DHAKA_OFFSET_MS);
}

export const addDays = (dateKey: string, n: number) => dhakaDateKey(+dhakaMidnight(dateKey) + n * DAY_MS);
export const isDateKey = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(+dhakaMidnight(v)) && dhakaDateKey(dhakaMidnight(v)) === v;

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** ?range=7d|30d|90d|custom&from=YYYY-MM-DD&to=YYYY-MM-DD → range (default 7d; bad input → default). */
export function parseRange(params: Params, now: Date = new Date()): DateRange {
  const today = dhakaDateKey(now);
  const raw = one(params.range);
  const key: RangeKey = (RANGE_KEYS as readonly string[]).includes(raw ?? "") ? (raw as RangeKey) : DEFAULT_RANGE;

  if (key === "custom") {
    const from = one(params.from);
    const to = one(params.to);
    if (isDateKey(from) && isDateKey(to) && from <= to && to <= today) {
      const days = Math.round((+dhakaMidnight(to) - +dhakaMidnight(from)) / DAY_MS) + 1;
      if (days <= MAX_CUSTOM_DAYS) return build("custom", from, to, days);
    }
    return parseRange({ range: DEFAULT_RANGE }, now);
  }
  const days = Number.parseInt(key, 10);
  return build(key, addDays(today, -(days - 1)), today, days);
}

function build(key: RangeKey, from: string, to: string, days: number): DateRange {
  const start = dhakaMidnight(from);
  const end = dhakaMidnight(addDays(to, 1));
  const prevStart = new Date(+start - days * DAY_MS);
  return {
    key,
    from,
    to,
    days,
    start: start.toISOString(),
    end: end.toISOString(),
    prevStart: prevStart.toISOString(),
    prevEnd: start.toISOString(),
    label: key === "custom" ? `${formatDhaka(start, "d MMM")} – ${formatDhaka(dhakaMidnight(to), "d MMM")}` : `Last ${days} days`,
    prevLabel: key === "custom" ? "Previous period" : `Previous ${days}days`,
  };
}

export type WeekKey = "this" | "last";

/** Sun–Sat Dhaka week (Report for this week): this week (to date) or last week. */
export function dhakaWeek(week: WeekKey, now: Date = new Date()) {
  const today = dhakaDateKey(now);
  const weekday = dhakaMidnight(today).getTime() + DHAKA_OFFSET_MS; // UTC midnight of the same calendar date
  const sunday = addDays(today, -new Date(weekday).getUTCDay() - (week === "last" ? 7 : 0));
  const days = Array.from({ length: 7 }, (_, i) => addDays(sunday, i));
  return {
    week,
    days,
    start: dhakaMidnight(sunday).toISOString(),
    end: dhakaMidnight(addDays(sunday, 7)).toISOString(),
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Format an instant in Dhaka time. Tokens: yyyy, yy, MMM, MM, dd, d, EEEE, EEE, HH, h, mm, a (am/pm), A (AM/PM).
 * "01 Oct | 11:29 am" = formatDhaka(date, "dd MMM | h:mm a").
 */
export function formatDhaka(instant: Date | string | number, pattern: string): string {
  const d = new Date(+new Date(instant) + DHAKA_OFFSET_MS);
  const h24 = d.getUTCHours();
  const tokens: Record<string, string> = {
    yyyy: String(d.getUTCFullYear()),
    yy: String(d.getUTCFullYear() % 100).padStart(2, "0"),
    MMM: MONTHS[d.getUTCMonth()]!,
    MM: String(d.getUTCMonth() + 1).padStart(2, "0"),
    dd: String(d.getUTCDate()).padStart(2, "0"),
    d: String(d.getUTCDate()),
    EEEE: WEEKDAYS[d.getUTCDay()]!,
    EEE: WEEKDAYS[d.getUTCDay()]!.slice(0, 3),
    HH: String(h24).padStart(2, "0"),
    h: String(h24 % 12 || 12),
    mm: String(d.getUTCMinutes()).padStart(2, "0"),
    a: h24 < 12 ? "am" : "pm",
    A: h24 < 12 ? "AM" : "PM",
  };
  return pattern.replace(/yyyy|yy|MMM|MM|EEEE|EEE|dd|d|HH|h|mm|a|A/g, (t) => tokens[t] ?? t);
}

/** Query string for a range (keeps other params), e.g. for the range menu links. */
export function rangeHref(pathname: string, current: URLSearchParams, next: { range: RangeKey; from?: string; to?: string }) {
  const p = new URLSearchParams(current);
  p.delete("from");
  p.delete("to");
  if (next.range === DEFAULT_RANGE) p.delete("range");
  else p.set("range", next.range);
  if (next.range === "custom" && next.from && next.to) {
    p.set("from", next.from);
    p.set("to", next.to);
  }
  const qs = p.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}
