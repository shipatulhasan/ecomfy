import { connection } from "next/server";
import { ActionError } from "@/lib/actions/result";
import { formatDhaka } from "@/lib/admin/date-range";
import { parseProductParams } from "@/lib/admin/products/params";
import { EXPORT_LIMIT, listAdminProducts } from "@/lib/queries/admin/products";

/**
 * Product List → download icon: CSV of every product matching the current
 * filters and sort (up to EXPORT_LIMIT rows). products:read, checked here.
 */
export async function GET(request: Request) {
  await connection();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  let page;
  try {
    page = await listAdminProducts(parseProductParams(sp), { all: true });
  } catch (err) {
    if (err instanceof ActionError) return new Response("Forbidden", { status: 403 });
    throw err; // redirect to /admin/login propagates
  }

  const header = ["SKU", "Name", "Status", "Category", "Price (BDT)", "Regular price (BDT)", "Stock", "Stock level", "Variants", "Created (Asia/Dhaka)", "Store URL"];
  const rows = page.rows.map((r) => [
    r.sku,
    r.name,
    r.status,
    r.category.name,
    (r.priceCents / 100).toFixed(2),
    r.compareAtCents ? (r.compareAtCents / 100).toFixed(2) : "",
    r.stock === null ? "unlimited" : String(r.stock),
    r.level,
    String(r.variantCount),
    formatDhaka(r.createdAt, "yyyy-MM-dd HH:mm"),
    `/product/${r.slug}`,
  ]);
  const csv = [header, ...rows].map((line) => line.map(cell).join(",")).join("\r\n");
  const stamp = formatDhaka(new Date(), "yyyy-MM-dd");

  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${stamp}.csv"`,
      "Cache-Control": "no-store",
      "X-Truncated": page.total > EXPORT_LIMIT ? "true" : "false",
    },
  });
}

/** RFC 4180 quoting + spreadsheet formula-injection guard. */
function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
