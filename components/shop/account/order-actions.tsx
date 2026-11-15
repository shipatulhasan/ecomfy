"use client";

import { EllipsisIcon, FileTextIcon, RotateCcwIcon, XCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AdaptiveSheet } from "@/components/shared/adaptive-sheet";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { useCart } from "@/components/shop/cart/cart-provider";
import { RetryPayment } from "@/components/shop/checkout/retry-payment";
import { cancelOrder, reorder } from "@/lib/actions/orders";
import type { CheckoutQuote } from "@/lib/checkout/pricing";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import type { OrderActions as Allowed } from "@/lib/queries/orders";
import { cn } from "@/lib/utils";

/**
 * Order Details actions. Which ones show is decided on the server
 * (lib/queries/orders.ts → actions); every action re-checks ownership and status.
 *
 * - Laptop+: a right-aligned button row under the products (`OrderActionsRow`).
 * - Below laptop: `OrderActionsBar` in a StickyActionBar above the tab bar. The
 *   primary action comes first (Pay now, else Order again); the rest go in a "More"
 *   bottom sheet.
 */
export type OrderActionsProps = {
  number: number;
  allowed: Allowed;
  /** Present when Pay now is allowed. */
  retry: { orderId: string; method: PaymentMethod; quote: CheckoutQuote; codFeeCents: number } | null;
};

const pill =
  "press inline-flex h-11.25 items-center justify-center gap-2 rounded-full px-6 text-copy font-semibold transition-colors disabled:opacity-60";
const primary = cn(pill, "bg-primary text-primary-foreground hover:bg-brand-dark");
const outline = cn(pill, "border border-primary text-primary hover:bg-secondary");
const danger = cn(pill, "border border-sale/40 text-sale hover:bg-sale-soft");

const invoiceHref = (n: number) => `/account/orders/${n}/invoice`;

/**
 * Not a transition on purpose: the new cart and the open drawer must commit
 * together, as soon as the action answers (inside a transition the cart update
 * would wait for the action's refresh() payload while the drawer opens on the old cart).
 */
function useOrderAgain(number: number) {
  const { hydrate, openDrawer } = useCart();
  const [pending, setPending] = useState(false);
  const run = async (after?: () => void) => {
    if (pending) return;
    setPending(true);
    const res = await reorder({ orderNumber: number });
    setPending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    hydrate(res.data.cart);
    for (const s of res.data.skipped) toast.warning(`${s.name} wasn't added`, { description: s.reason });
    after?.();
    openDrawer();
  };
  return { pending, run };
}

function useCancel(number: number) {
  const [pending, start] = useTransition();
  const run = (onDone: () => void) =>
    start(async () => {
      const res = await cancelOrder({ orderNumber: number });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Order #${number} was cancelled`);
      onDone();
    });
  return { pending, run };
}

function PayNowSheet({ retry, number, className }: { retry: NonNullable<OrderActionsProps["retry"]>; number: number; className?: string }) {
  return (
    <AdaptiveSheet
      title={`Pay for order #${number}`}
      description="Try the same method again or choose another one. Your order and its items are kept."
      trigger={
        <button type="button" className={cn(primary, className)}>
          Pay now
        </button>
      }
    >
      <RetryPayment orderId={retry.orderId} method={retry.method} quote={retry.quote} codFeeCents={retry.codFeeCents} />
    </AdaptiveSheet>
  );
}

const cancelBody = "The items go back on the shelf. If you already started an online payment, it's cancelled too.";

function CancelSheet({ number }: { number: number }) {
  const [open, setOpen] = useState(false);
  const { pending, run } = useCancel(number);
  return (
    <AdaptiveSheet
      open={open}
      onOpenChange={setOpen}
      title={`Cancel order #${number}?`}
      description={cancelBody}
      trigger={
        <button type="button" className={danger}>
          Cancel order
        </button>
      }
      footer={
        <div className="flex flex-col gap-3">
          <button type="button" disabled={pending} onClick={() => run(() => setOpen(false))} className={cn(pill, "bg-sale text-primary-foreground", pending && "animate-pulse")}>
            {pending ? "Cancelling…" : "Yes, cancel order"}
          </button>
          <button type="button" disabled={pending} onClick={() => setOpen(false)} className={outline}>
            Keep order
          </button>
        </div>
      }
    >
      <p className="text-copy text-text-body">This can&apos;t be undone.</p>
    </AdaptiveSheet>
  );
}

/** Laptop+: inline row. */
export function OrderActionsRow({ number, allowed, retry, className }: OrderActionsProps & { className?: string }) {
  const again = useOrderAgain(number);
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-3", className)}>
      {allowed.invoice && (
        <a href={invoiceHref(number)} target="_blank" rel="noopener" className={cn(pill, "text-primary hover:underline")}>
          <FileTextIcon aria-hidden className="size-4" />
          Download invoice
        </a>
      )}
      {allowed.cancel && <CancelSheet number={number} />}
      {allowed.orderAgain && (
        <button
          type="button"
          disabled={again.pending}
          onClick={() => again.run()}
          className={cn(allowed.payNow ? outline : primary, again.pending && "animate-pulse")}
        >
          <RotateCcwIcon aria-hidden className="size-4" />
          Order again
        </button>
      )}
      {allowed.payNow && retry && <PayNowSheet retry={retry} number={number} />}
    </div>
  );
}

/** Below laptop: sticky bar with the primary action and a "More" sheet. */
export function OrderActionsBar({ number, allowed, retry }: OrderActionsProps) {
  const again = useOrderAgain(number);
  const cancel = useCancel(number);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const payNow = allowed.payNow && retry;
  const primaryAction: "pay" | "again" | null = payNow ? "pay" : allowed.orderAgain ? "again" : null;
  const moreItems = {
    again: allowed.orderAgain && primaryAction !== "again",
    cancel: allowed.cancel,
    invoice: allowed.invoice,
  };
  const hasMore = Object.values(moreItems).some(Boolean);
  if (!primaryAction && !hasMore) return null;

  const row = "press flex min-h-14 w-full items-center gap-3 text-left text-lead";

  return (
    <StickyActionBar>
      {primaryAction === "pay" && retry && <PayNowSheet retry={retry} number={number} className="flex-1" />}
      {primaryAction === "again" && (
        <button
          type="button"
          disabled={again.pending}
          onClick={() => again.run()}
          className={cn(primary, "flex-1", again.pending && "animate-pulse")}
        >
          <RotateCcwIcon aria-hidden className="size-4" />
          Order again
        </button>
      )}
      {hasMore && (
        <BottomSheet
          open={moreOpen}
          onOpenChange={(o) => {
            setMoreOpen(o);
            if (!o) setConfirming(false);
          }}
          title={confirming ? `Cancel order #${number}?` : `Order #${number}`}
          description={confirming ? cancelBody : undefined}
          trigger={
            <button type="button" className={cn(outline, primaryAction ? "px-4" : "flex-1")} aria-label="More order actions">
              <EllipsisIcon aria-hidden className="size-5" />
              {!primaryAction && "Actions"}
            </button>
          }
        >
          {confirming ? (
            <div className="flex flex-col gap-3 pt-2">
              <button
                type="button"
                disabled={cancel.pending}
                onClick={() => cancel.run(() => setMoreOpen(false))}
                className={cn(pill, "bg-sale text-primary-foreground", cancel.pending && "animate-pulse")}
              >
                {cancel.pending ? "Cancelling…" : "Yes, cancel order"}
              </button>
              <button type="button" disabled={cancel.pending} onClick={() => setConfirming(false)} className={outline}>
                Keep order
              </button>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {moreItems.again && (
                <button type="button" disabled={again.pending} onClick={() => again.run(() => setMoreOpen(false))} className={cn(row, "text-foreground")}>
                  <RotateCcwIcon aria-hidden className="size-5 text-muted-foreground" />
                  Order again
                </button>
              )}
              {moreItems.invoice && (
                <a href={invoiceHref(number)} target="_blank" rel="noopener" className={cn(row, "text-foreground")}>
                  <FileTextIcon aria-hidden className="size-5 text-muted-foreground" />
                  Download invoice
                </a>
              )}
              {moreItems.cancel && (
                <button type="button" onClick={() => setConfirming(true)} className={cn(row, "text-sale")}>
                  <XCircleIcon aria-hidden className="size-5" />
                  Cancel order
                </button>
              )}
            </div>
          )}
        </BottomSheet>
      )}
    </StickyActionBar>
  );
}
