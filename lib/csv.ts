/**
 * CSV helpers for admin exports (RFC 4180, CRLF, UTF-8 with BOM for Excel).
 * Text cells get the spreadsheet formula-injection guard; numbers are written as-is
 * (so a negative refund stays a number, not "'-120.00").
 */
export const CSV_BOM = "﻿";

export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export const csvLine = (cells: (string | number | null | undefined)[]) => `${cells.map(csvCell).join(",")}\r\n`;

/** Cents → "1234.50" as a number cell. */
export const csvMoney = (cents: number | null | undefined) => (cents === null || cents === undefined ? null : Number((cents / 100).toFixed(2)));
