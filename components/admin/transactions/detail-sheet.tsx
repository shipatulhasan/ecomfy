import { ExternalLinkIcon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { DetailCard, DetailRow } from "@/components/admin/detail-blocks";
import { CopyButton } from "@/components/admin/orders/detail/forms";
import { StatusChip } from "@/components/shared/status-chip";
import { formatDhaka } from "@/lib/admin/date-range";
import { adminOrderHref, METHOD_LABELS, orderRef } from "@/lib/admin/orders/params";
import { txnSheetHref, type TxnListParams } from "@/lib/admin/transactions/params";
import { formatPrice } from "@/lib/money";
import { ADMIN_STATUS_LABELS, ATTEMPT_LABEL, ATTEMPT_TONE, PAYMENT_TYPE_LABEL } from "@/lib/orders/status";
import { ATTENTION_LABELS } from "@/lib/payments/attention-labels";
import { getTransactionDetail, type AdminTxnDetail } from "@/lib/queries/admin/transactions";
import { MethodLogo, TxnAmount, TxnStatusText, TxnTypeTag } from "./cells";
import { TxnSheetFrame } from "./sheet-frame";
import { VerifyButton } from "./verify-button";

/**
 * Transaction detail (no design): a right side sheet built from the Order detail
 * blocks (DetailCard / DetailRow, StatusChip, CopyButton). Amount + status, method
 * and type, gateway ids, order and customer, initiated → processed, fee and net,
 * why it needs attention, the other rows on the same order and, for ADMIN only,
 * the redacted gateway log. "Verify with gateway" needs payments:reconcile.
 */
const dateTime = (iso: string) => formatDhaka(iso, "dd MMM yyyy, h:mm:ss a");
const card = "border border-border p-4 tablet:p-5";

export async function TxnDetailSheet({ id, params, closeHref, canReconcile }: { id: string; params: TxnListParams; closeHref: string; canReconcile: boolean }) {
  const t = await getTransactionDetail(id);
  if (!t) {
    return (
      <TxnSheetFrame closeHref={closeHref} title="Transaction not found">
        <p className="text-copy text-muted-foreground">This transaction doesn&apos;t exist, or it was removed with its order.</p>
      </TxnSheetFrame>
    );
  }
  const open = t.status === "INITIATED" || t.status === "PENDING";
  const verifiable = canReconcile && t.type === "CHARGE" && t.method !== "COD" && (open || t.attention.length > 0);

  return (
    <TxnSheetFrame
      closeHref={closeHref}
      title="Transaction details"
      description={
        <span className="inline-flex items-center gap-1 font-mono">
          {t.gatewayId}
          <CopyButton value={t.gatewayId} label="Copy transaction id" className="size-7" />
        </span>
      }
      footer={verifiable ? <VerifyButton id={t.id} className="h-11 w-full" /> : undefined}
    >
      <div className="flex flex-col gap-4">
        <HeaderCard t={t} />
        {t.attention.length > 0 && <AttentionCard t={t} />}
        <PaymentCard t={t} />
        <GatewayCard t={t} />
        <OrderCard t={t} />
        <TimelineCard t={t} />
        {t.siblings.length > 0 && <SiblingsCard t={t} params={params} />}
        {t.raw !== null && <RawCard raw={t.raw} />}
      </div>
    </TxnSheetFrame>
  );
}

function HeaderCard({ t }: { t: AdminTxnDetail }) {
  return (
    <section aria-label="Amount and status" className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-secondary p-4 tablet:p-5">
      <div>
        <p className="text-caption text-text-body">{PAYMENT_TYPE_LABEL[t.type]}</p>
        <TxnAmount cents={t.amountCents} className="text-display font-bold" />
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <StatusChip tone={ATTEMPT_TONE[t.status]}>{ATTEMPT_LABEL[t.status]}</StatusChip>
        <MethodLogo method={t.method} withLabel />
      </div>
    </section>
  );
}

function AttentionCard({ t }: { t: AdminTxnDetail }) {
  return (
    <section aria-labelledby="txn-attention" role="note" className="rounded-xl bg-warning-soft p-4 text-warning-strong tablet:p-5">
      <h2 id="txn-attention" className="flex items-center gap-2 text-h4 font-bold">
        <TriangleAlertIcon aria-hidden className="size-5" /> Needs attention
      </h2>
      <ul className="mt-2 list-disc pl-6 text-copy">
        {t.attention.map((a) => (
          <li key={a}>{ATTENTION_LABELS[a]}</li>
        ))}
      </ul>
    </section>
  );
}

function PaymentCard({ t }: { t: AdminTxnDetail }) {
  const net = t.feeCents !== null && t.amountCents > 0 ? t.amountCents - t.feeCents : null;
  return (
    <DetailCard title="Payment" titleId="txn-payment" className={card}>
      <dl className="flex flex-col divide-y divide-border">
        <DetailRow label="Method">{METHOD_LABELS[t.method]}</DetailRow>
        <DetailRow label="Type">
          <span className="inline-flex items-center gap-2">
            {PAYMENT_TYPE_LABEL[t.type]} <TxnTypeTag type={t.type} />
          </span>
        </DetailRow>
        <DetailRow label="Status">
          <TxnStatusText status={t.status} />
        </DetailRow>
        {t.attempt !== null && <DetailRow label="Attempt">#{t.attempt}</DetailRow>}
        <DetailRow label="Amount">
          <TxnAmount cents={t.amountCents} /> {t.currency !== "BDT" && t.currency}
        </DetailRow>
        <DetailRow label="Gateway fee">{t.feeCents !== null ? formatPrice(t.feeCents) : <span className="text-muted-foreground">Not reported</span>}</DetailRow>
        {net !== null && <DetailRow label="Net received">{formatPrice(net)}</DetailRow>}
        {(t.cardBrand || t.cardIssuer) && <DetailRow label="Card">{[t.cardBrand, t.cardIssuer].filter(Boolean).join(" · ")}</DetailRow>}
        {t.failReason && <DetailRow label="Reason">{t.failReason}</DetailRow>}
        {t.refundNote && <DetailRow label="Refund note">{t.refundNote}</DetailRow>}
      </dl>
    </DetailCard>
  );
}

function IdRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <DetailRow label={label}>
      <span className="inline-flex items-center gap-1">
        <span className="font-mono text-caption break-all">{value}</span>
        <CopyButton value={value} label={`Copy ${label}`} className="size-7" />
      </span>
    </DetailRow>
  );
}

function GatewayCard({ t }: { t: AdminTxnDetail }) {
  return (
    <DetailCard title="Gateway IDs" titleId="txn-gateway" className={card}>
      <dl className="flex flex-col divide-y divide-border">
        <IdRow label="Our reference" value={t.reference} />
        <IdRow label="bKash paymentID" value={t.paymentId} />
        <IdRow label="bKash trxID" value={t.trxId} />
        <IdRow label="SSLCommerz tran_id" value={t.method === "SSLCOMMERZ" && t.type === "CHARGE" ? t.reference : null} />
        <IdRow label="SSLCommerz val_id" value={t.valId} />
        <IdRow label="Bank transaction" value={t.bankTranId} />
      </dl>
    </DetailCard>
  );
}

function OrderCard({ t }: { t: AdminTxnDetail }) {
  const c = t.customer;
  return (
    <DetailCard
      title="Order & customer"
      titleId="txn-order"
      className={card}
      action={
        <Link href={adminOrderHref(t.order.number)} className="tap-target inline-flex items-center gap-1 text-copy text-info hover:underline">
          Open order <ExternalLinkIcon aria-hidden className="size-4" />
        </Link>
      }
    >
      <dl className="flex flex-col divide-y divide-border">
        <DetailRow label="Order">
          <Link href={adminOrderHref(t.order.number)} className="hover:text-primary hover:underline">
            {orderRef(t.order.number)} · {t.order.orderNumber}
          </Link>
        </DetailRow>
        <DetailRow label="Order status">{ADMIN_STATUS_LABELS[t.orderInfo.status]}</DetailRow>
        <DetailRow label="Order total">{formatPrice(t.orderInfo.totalCents)}</DetailRow>
        {t.orderInfo.refundedCents > 0 && <DetailRow label="Refunded on order">{formatPrice(t.orderInfo.refundedCents)}</DetailRow>}
        <DetailRow label="Customer">{c.name}</DetailRow>
        {c.email && <DetailRow label="Email">{c.email}</DetailRow>}
        {c.phone && <DetailRow label="Phone">{c.phone}</DetailRow>}
      </dl>
    </DetailCard>
  );
}

function TimelineCard({ t }: { t: AdminTxnDetail }) {
  const steps = [
    { label: "Initiated", at: t.createdAt },
    { label: t.status === "SUCCEEDED" || t.status === "REFUNDED" ? "Processed" : "Closed", at: t.completedAt },
    { label: "Last updated", at: t.updatedAt },
  ];
  return (
    <DetailCard title="Timeline" titleId="txn-timeline" className={card}>
      <ol className="flex flex-col gap-3 border-l-2 border-border pl-4">
        {steps.map((s) => (
          <li key={s.label} className="relative">
            <span aria-hidden className={`absolute top-1.5 -left-5.25 size-2.5 rounded-full ${s.at ? "bg-primary" : "bg-border"}`} />
            <p className="text-copy font-medium text-foreground">{s.label}</p>
            <p className="text-caption text-muted-foreground tabular-nums">{s.at ? dateTime(s.at) : "Not yet"}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-caption text-muted-foreground">Times are Asia/Dhaka.</p>
    </DetailCard>
  );
}

function SiblingsCard({ t, params }: { t: AdminTxnDetail; params: TxnListParams }) {
  return (
    <DetailCard title={`Other transactions on ${orderRef(t.order.number)}`} titleId="txn-siblings" className={card}>
      <ul className="flex flex-col divide-y divide-border">
        {t.siblings.map((s) => (
          <li key={s.id}>
            <Link href={txnSheetHref(params, s.id)} replace scroll={false} className="flex items-center justify-between gap-3 py-2.5 text-copy hover:bg-muted">
              <span className="min-w-0">
                <span className="block truncate font-mono text-caption text-foreground">{s.reference}</span>
                <span className="text-caption text-muted-foreground">
                  {PAYMENT_TYPE_LABEL[s.type]} · {METHOD_LABELS[s.method]} · {formatDhaka(s.createdAt, "dd MMM, h:mm a")}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <TxnAmount cents={s.amountCents} />
                <TxnStatusText status={s.status} className="text-caption" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DetailCard>
  );
}

function RawCard({ raw }: { raw: unknown }) {
  return (
    <details className="rounded-xl border border-border p-4 tablet:p-5">
      <summary className="cursor-pointer text-copy font-medium text-primary">Raw gateway response (admins only)</summary>
      <p className="mt-2 text-caption text-muted-foreground">Secrets and tokens are redacted before they are stored.</p>
      <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-muted p-3 text-caption break-all whitespace-pre-wrap text-text-body">{JSON.stringify(raw, null, 2)}</pre>
    </details>
  );
}
