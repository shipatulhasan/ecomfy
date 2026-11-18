import { PackageIcon, ShieldAlertIcon, TruckIcon } from "lucide-react";
import Image from "next/image";
import { StatusChip } from "@/components/shared/status-chip";
import { METHOD_LABELS } from "@/lib/admin/orders/params";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";
import { ADMIN_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/orders/status";
import { cn } from "@/lib/utils";

/**
 * Order Management.png cells, shared by the list (table + cards) and the detail page.
 */

/** Status text colour per status: the PNG's green "Delivered", orange "Pending", plain "Shipped", red "Cancelled". */
const STATUS_TEXT: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "text-warning-strong",
  PENDING_CONFIRMATION: "text-warning-strong",
  PROCESSING: "text-info-strong",
  SHIPPED: "text-foreground",
  DELIVERED: "text-success",
  CANCELLED: "text-sale",
  EXPIRED: "text-muted-foreground",
  FAILED: "text-sale",
  RETURNED: "text-text-body",
};

/** PNG "Status": truck glyph + coloured label, no pill. */
export function OrderStatusText({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 whitespace-nowrap", STATUS_TEXT[status], className)}>
      <TruckIcon aria-hidden className="size-5 shrink-0 stroke-[1.5]" />
      {ADMIN_STATUS_LABELS[status]}
    </span>
  );
}

const PAYMENT_DOT: Record<PaymentStatus, string> = {
  PAID: "bg-success",
  UNPAID: "bg-sale",
  FAILED: "bg-sale",
  REFUNDED: "bg-muted-foreground",
};

/** PNG "Payment": dot + Paid / Unpaid; the method sits above it (not in the PNG). */
export function PaymentCell({ method, status, inline }: { method: PaymentMethod; status: PaymentStatus; inline?: boolean }) {
  return (
    <span className={cn("inline-flex", inline ? "items-center gap-2" : "flex-col leading-5")}>
      <span className={cn("text-caption text-muted-foreground", inline && "text-copy")}>{METHOD_LABELS[method]}</span>
      <span className="inline-flex items-center gap-2 whitespace-nowrap">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", PAYMENT_DOT[status])} />
        {PAYMENT_STATUS_LABELS[status]}
      </span>
    </span>
  );
}

/** COD order whose phone has earlier cancelled COD orders. */
export function FlagBadge({ reason, className }: { reason: string | null; className?: string }) {
  return (
    <StatusChip tone="warning" className={cn("gap-1", className)}>
      <ShieldAlertIcon aria-hidden className="size-3.5" />
      <span title={reason ?? undefined}>Flagged</span>
      {reason && <span className="sr-only">: {reason}</span>}
    </StatusChip>
  );
}

/** PNG product thumbnail: 40 square, 1px border, 4 radius. */
export function ItemThumb({ src, className, sizes = "40px" }: { src: string | null; className?: string; sizes?: string }) {
  return (
    <span className={cn("relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card", className)}>
      {src ? (
        <Image src={src} alt="" fill sizes={sizes} className="object-contain p-0.5" />
      ) : (
        <PackageIcon aria-hidden className="size-1/2 text-muted-foreground" />
      )}
    </span>
  );
}
