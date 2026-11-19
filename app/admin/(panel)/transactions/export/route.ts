import { connection } from "next/server";
import { ActionError } from "@/lib/actions/result";
import { formatDhaka } from "@/lib/admin/date-range";
import { parseTxnParams, txnParamsQuery } from "@/lib/admin/transactions/params";
import { logAudit } from "@/lib/audit";
import { requirePermission } from "@/lib/auth-guards";
import { CSV_BOM, csvLine, csvMoney } from "@/lib/csv";
import { ATTEMPT_LABEL, PAYMENT_TYPE_LABEL } from "@/lib/orders/status";
import { ATTENTION_LABELS } from "@/lib/payments/attention-labels";
import { streamTransactionsForExport } from "@/lib/queries/admin/transactions";

/**
 * Transactions → Export CSV: every row matching the current tab, filters and sort,
 * streamed in batches (the response starts right away; memory stays flat however
 * many rows match). `payments:export`, checked here and in the query. Audited.
 */
export async function GET(request: Request) {
  await connection();
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const params = { ...parseTxnParams(sp), txn: null };
  let actor;
  try {
    actor = await requirePermission("payments:export");
  } catch (err) {
    if (err instanceof ActionError) return new Response("Forbidden", { status: 403 });
    throw err; // redirect to /admin/login propagates
  }
  await logAudit({
    actorId: actor.id,
    action: "payment.export",
    entity: "Payment",
    after: { filters: txnParamsQuery(params, { page: 1 }) || "all" },
  });

  const header = [
    "Transaction ID",
    "Reference",
    "Order",
    "Order reference",
    "Created (Asia/Dhaka)",
    "Processed (Asia/Dhaka)",
    "Customer",
    "Email",
    "Phone",
    "Method",
    "Type",
    "Status",
    "Amount (BDT)",
    "Fee (BDT)",
    "Card",
    "Reason",
    "Needs attention",
  ];
  const encoder = new TextEncoder();
  const rows = streamTransactionsForExport(params, actor);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(CSV_BOM + csvLine(header)));
    },
    async pull(controller) {
      try {
        const next = await rows.next();
        if (next.done) {
          controller.close();
          return;
        }
        let chunk = "";
        for (const r of next.value) {
          chunk += csvLine([
            r.gatewayId,
            r.reference,
            r.order.number,
            r.order.orderNumber,
            formatDhaka(r.createdAt, "yyyy-MM-dd HH:mm"),
            r.completedAt ? formatDhaka(r.completedAt, "yyyy-MM-dd HH:mm") : "",
            r.customer.name,
            r.customer.email,
            r.customer.phone,
            r.method,
            PAYMENT_TYPE_LABEL[r.type],
            ATTEMPT_LABEL[r.status],
            csvMoney(r.amountCents),
            csvMoney(r.feeCents),
            r.cardBrand,
            r.failReason,
            r.attention.map((a) => ATTENTION_LABELS[a]).join("; "),
          ]);
        }
        controller.enqueue(encoder.encode(chunk));
      } catch (err) {
        console.error("[transactions] export failed", err);
        controller.error(err);
      }
    },
    async cancel() {
      await rows.return(undefined);
    },
  });
  const stamp = formatDhaka(new Date(), "yyyy-MM-dd");
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
