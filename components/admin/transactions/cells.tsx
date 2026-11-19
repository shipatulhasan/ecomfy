import Image from "next/image";
import { StatusChip } from "@/components/shared/status-chip";
import { METHOD_LABELS } from "@/lib/admin/orders/params";
import { paymentMethodMeta } from "@/lib/config/checkout";
import type { PaymentAttemptStatus, PaymentMethod, PaymentType } from "@/lib/generated/prisma/enums";
import { formatPrice } from "@/lib/money";
import { ATTEMPT_LABEL } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

/**
 * Transaction.png "Status": 8px dot + coloured label (Complete green, Pending amber,
 * Canceled red). INITIATED reads "Pending" here, like the tab it sits in; the
 * detail sheet's chip keeps the exact state ("Started").
 */
const STATUS_TEXT: Record<PaymentAttemptStatus, { text: string; dot: string }> = {
  SUCCEEDED: { text: "text-success", dot: "bg-success" },
  INITIATED: { text: "text-warning-strong", dot: "bg-warning" },
  PENDING: { text: "text-warning-strong", dot: "bg-warning" },
  FAILED: { text: "text-sale", dot: "bg-sale" },
  CANCELLED: { text: "text-sale", dot: "bg-sale" },
  EXPIRED: { text: "text-muted-foreground", dot: "bg-muted-foreground" },
  REFUNDED: { text: "text-info-strong", dot: "bg-info" },
};

export function TxnStatusText({ status, className }: { status: PaymentAttemptStatus; className?: string }) {
  const s = STATUS_TEXT[status];
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", s.text, className)}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", s.dot)} />
      {status === "INITIATED" ? "Pending" : ATTEMPT_LABEL[status]}
    </span>
  );
}

/** Method logo (checkout logos) with the short label for screen readers / below it. */
export function MethodLogo({ method, withLabel = false, className }: { method: PaymentMethod; withLabel?: boolean; className?: string }) {
  const meta = paymentMethodMeta[method];
  return (
    <span className={cn("inline-flex items-center gap-2", className)} title={METHOD_LABELS[method]}>
      <Image src={meta.logo} alt={withLabel ? "" : METHOD_LABELS[method]} width={56} height={28} unoptimized className="h-6 w-auto" />
      {withLabel && <span className="text-copy text-foreground">{METHOD_LABELS[method]}</span>}
    </span>
  );
}

/** Signed amount: refunds (negative) in red with a minus sign. */
export function TxnAmount({ cents, className }: { cents: number; className?: string }) {
  const refund = cents < 0;
  return (
    <span className={cn("tabular-nums", refund && "text-sale", className)}>
      {refund ? `−${formatPrice(-cents)}` : formatPrice(cents)}
    </span>
  );
}

/** Small tag for the non-charge types (the PNG only has charges). */
export function TxnTypeTag({ type, className }: { type: PaymentType; className?: string }) {
  if (type === "CHARGE") return null;
  return (
    <StatusChip tone={type === "REFUND" ? "danger" : "neutral"} className={cn("px-2 py-0 whitespace-nowrap", className)}>
      {type === "REFUND" ? "Refund" : "COD"}
    </StatusChip>
  );
}
