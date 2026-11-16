import { connection } from "next/server";
import { ActionError } from "@/lib/actions/result";
import { formatDhaka } from "@/lib/admin/date-range";
import { parseCategoryParams } from "@/lib/admin/categories/params";
import { getAdminCategoryPage } from "@/lib/queries/admin/categories";

/**
 * Categories → ⋯ → Export CSV: every category matching the current filters, in
 * tree order (parent, then its subcategories). categories:read, checked here.
 */
export async function GET(request: Request) {
  await connection();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  let page;
  try {
    page = await getAdminCategoryPage(parseCategoryParams(sp), { all: true });
  } catch (err) {
    if (err instanceof ActionError) return new Response("Forbidden", { status: 403 });
    throw err; // redirect to /admin/login propagates
  }

  const header = ["Name", "Slug", "Parent", "Active", "Featured on home", "Products", "Subcategories", "Sort order", "Created (Asia/Dhaka)", "Store URL"];
  const rows = page.families.flatMap((f) =>
    [f, ...f.children].map((r) => [
      r.name,
      r.slug,
      r.parentId ? f.name : "",
      r.isActive ? "yes" : "no",
      r.isFeatured ? "yes" : "no",
      String(r.productCount),
      String(r.childCount),
      String(r.sortOrder),
      formatDhaka(r.createdAt, "yyyy-MM-dd HH:mm"),
      `/shop?category=${r.slug}`,
    ]),
  );
  const csv = [header, ...rows].map((line) => line.map(cell).join(",")).join("\r\n");
  const stamp = formatDhaka(new Date(), "yyyy-MM-dd");

  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="categories-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/** RFC 4180 quoting + spreadsheet formula-injection guard. */
function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
