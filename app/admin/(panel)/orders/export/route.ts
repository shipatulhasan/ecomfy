import { connection } from "next/server";
import { ActionError } from "@/lib/actions/result";
import { formatDhaka } from "@/lib/admin/date-range";
import { parseOrderParams } from "@/lib/admin/orders/params";
import { csvCell as cell } from "@/lib/csv";
import { EXPORT_LIMIT, listOrdersForExport, parseNumberList } from "@/lib/queries/admin/orders";

/**
 * Order Management → Export CSV: every order matching the current tab, filters and
 * sort (up to EXPORT_LIMIT rows), or the selected orders (?n=1,2,3 from the bulk
 * bar). orders:read, checked here. Customer PII: never cached.
 */
export async function GET(request: Request) {
  await connection();
  const url = new URL(request.url);
  const sp = Object.fromEntries(url.searchParams);
  let rows;
  try {
    rows = await listOrdersForExport(parseOrderParams(sp), parseNumberList(url.searchParams.get("n")));
  } catch (err) {
    if (err instanceof ActionError) return new Response("Forbidden", { status: 403 });
    throw err; // redirect to /admin/login propagates
  }

  const money = (c: number) => (c / 100).toFixed(2);
  const header = [
    "Order",
    "Reference",
    "Placed (Asia/Dhaka)",
    "Customer",
    "Email",
    "Phone",
    "District",
    "Items",
    "Lines",
    "Subtotal (BDT)",
    "Discount (BDT)",
    "Coupon",
    "Shipping (BDT)",
    "COD fee (BDT)",
    "Total (BDT)",
    "Refunded (BDT)",
    "Payment method",
    "Payment status",
    "Paid at (Asia/Dhaka)",
    "Status",
    "Courier",
    "Tracking",
    "Flagged COD",
  ];
  const lines = rows.map((r) => [
    String(r.number),
    r.orderNumber,
    formatDhaka(r.createdAt, "yyyy-MM-dd HH:mm"),
    r.customer.name,
    r.customer.email,
    r.customer.phone,
    r.district,
    String(r.itemCount),
    r.lines,
    money(r.subtotalCents),
    money(r.discountCents),
    r.couponCode ?? "",
    money(r.shippingCents),
    money(r.codFeeCents),
    money(r.totalCents),
    money(r.refundedCents),
    r.paymentMethod,
    r.paymentStatus,
    r.paidAt ? formatDhaka(r.paidAt, "yyyy-MM-dd HH:mm") : "",
    r.status,
    r.courier ?? "",
    r.trackingNumber ?? "",
    r.codFlagged ? "yes" : "",
  ]);
  const csv = [header, ...lines].map((line) => line.map(cell).join(",")).join("\r\n");
  const stamp = formatDhaka(new Date(), "yyyy-MM-dd");

  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Truncated": rows.length >= EXPORT_LIMIT ? "true" : "false",
    },
  });
}
