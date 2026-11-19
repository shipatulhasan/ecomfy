"use client";

import { BanIcon, EllipsisIcon, MailIcon, PrinterIcon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { Button } from "@/components/ui/button";
import { changeOrderStatus, resendOrderEmail } from "@/lib/actions/admin-orders";
import { orderRef } from "@/lib/admin/orders/params";
import type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/generated/prisma/enums";
import { adminNextStatuses, primaryNext, transitionLabel } from "@/lib/orders/transitions";
import { cn } from "@/lib/utils";
import { ReturnDialog, STATUS_ICON } from "../list/row-actions";
import { invoiceHref, printInvoice } from "../print-invoice";
import { CancelDialog, ShipDialog } from "../status-dialogs";
import { useOrderAction } from "../use-order-action";

export type ActionsOrder = {
  number: number;
  version: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveredAt: string | null;
  courier: string | null;
  trackingNumber: string | null;
};

type Props = { order: ActionsOrder; couriers: string[]; returnWindowDays: number; canUpdate: boolean; hasEmail: boolean };

/** Add Products.png "Publish Product" button (the vendored Button's class merge drops colours next to `text-lead`). */
const primaryButton =
  "press inline-flex h-12 items-center justify-center rounded-lg bg-primary px-4 text-lead font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50";

const DONE: Partial<Record<OrderStatus, string>> = {
  PROCESSING: "confirmed. The customer will get an email.",
  DELIVERED: "marked delivered.",
  RETURNED: "marked returned. Stock was put back.",
};

/**
 * Order detail actions (no design): primary = the next logical step from the
 * transitions map (Confirm order / Mark shipped / Mark delivered); then Cancel,
 * Mark returned (when valid), Print invoice, Resend email. Laptop+: a card in the
 * right column. Below laptop: the primary action in a StickyActionBar with the
 * rest in a "More" bottom sheet.
 */
export function OrderActionsCard(props: Props) {
  const a = useOrderActions(props);
  return (
    <section aria-labelledby="actions-title" className="hidden min-w-0 rounded-xl bg-card p-4 tablet:p-6 laptop:block">
      <h2 id="actions-title" className="text-h2 text-foreground">
        Actions
      </h2>
      <div className="mt-4 flex flex-col gap-3">
        {a.primary && (
          <button type="button" className={cn(primaryButton, "w-full")} disabled={a.pending} onClick={() => a.start(a.primary!)}>
            {a.label(a.primary)}
          </button>
        )}
        {!props.canUpdate && <p className="rounded-lg bg-info-soft px-4 py-3 text-copy text-info-strong">View only: your role can see orders but not change them.</p>}
        {props.canUpdate && !a.primary && a.secondary.length === 0 && (
          <p className="text-copy text-muted-foreground">No further status changes for this order.</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {a.secondary.map((s) => {
            const Icon = STATUS_ICON[s] ?? BanIcon;
            return (
              <Button
                key={s}
                size="lg"
                variant="outline"
                className={cn("h-11", s === "CANCELLED" && "text-sale hover:text-sale")}
                disabled={a.pending}
                onClick={() => a.start(s)}
              >
                <Icon aria-hidden /> {s === "CANCELLED" ? "Cancel" : "Returned"}
              </Button>
            );
          })}
          <Button size="lg" variant="outline" className="h-11" onClick={() => printInvoice(invoiceHref(props.order.number))}>
            <PrinterIcon aria-hidden /> Invoice
          </Button>
          {props.canUpdate && props.hasEmail && (
            <Button size="lg" variant="outline" className="h-11" disabled={a.pending} onClick={a.resend}>
              <MailIcon aria-hidden /> Resend email
            </Button>
          )}
        </div>
      </div>
      {a.dialogs}
    </section>
  );
}

export function OrderActionsBar(props: Props) {
  const a = useOrderActions(props);
  const [more, setMore] = useState(false);
  const item = "tap-target flex w-full items-center gap-3 rounded-lg px-3 py-3 text-lead text-foreground hover:bg-muted disabled:opacity-50";
  const pick = (fn: () => void) => () => {
    setMore(false);
    fn();
  };

  return (
    <>
      <StickyActionBar>
        {a.primary ? (
          <button type="button" className={cn(primaryButton, "flex-1")} disabled={a.pending} onClick={() => a.start(a.primary!)}>
            {a.label(a.primary)}
          </button>
        ) : (
          <p className="flex-1 text-copy text-muted-foreground">{props.canUpdate ? "No further status changes." : "View only"}</p>
        )}
        <BottomSheet
          open={more}
          onOpenChange={setMore}
          title={`Order ${orderRef(props.order.number)}`}
          closeOnLink
          trigger={
            <Button size="lg" variant="outline" className="h-12 px-4">
              <EllipsisIcon aria-hidden /> More
            </Button>
          }
        >
          <ul className="flex flex-col py-1">
            {a.secondary.map((s) => {
              const Icon = s === "CANCELLED" ? BanIcon : Undo2Icon;
              return (
                <li key={s}>
                  <button type="button" className={cn(item, s === "CANCELLED" && "text-sale")} disabled={a.pending} onClick={pick(() => a.start(s))}>
                    <Icon aria-hidden className="size-5" /> {a.label(s)}
                  </button>
                </li>
              );
            })}
            <li>
              <button type="button" className={item} onClick={pick(() => printInvoice(invoiceHref(props.order.number)))}>
                <PrinterIcon aria-hidden className="size-5" /> Print invoice
              </button>
            </li>
            {props.canUpdate && props.hasEmail && (
              <li>
                <button type="button" className={item} disabled={a.pending} onClick={pick(a.resend)}>
                  <MailIcon aria-hidden className="size-5" /> Resend email
                </button>
              </li>
            )}
          </ul>
        </BottomSheet>
      </StickyActionBar>
      {a.dialogs}
    </>
  );
}

function useOrderActions({ order, couriers, returnWindowDays, canUpdate }: Props) {
  const { run, pending } = useOrderAction();
  const [dialog, setDialog] = useState<"ship" | "cancel" | "return" | null>(null);
  const ctx = { status: order.status, deliveredAt: order.deliveredAt, returnWindowDays };
  const next = canUpdate ? adminNextStatuses(ctx) : [];
  const primary = canUpdate ? primaryNext(ctx) : null;
  const secondary = next.filter((s) => s !== primary && (s === "CANCELLED" || s === "RETURNED"));
  const dialogOrder = { ...order, paid: order.paymentStatus === "PAID" };

  const direct = (to: "PROCESSING" | "DELIVERED" | "RETURNED") =>
    run(() => changeOrderStatus({ orderNumber: order.number, version: order.version, to }), () => `Order ${orderRef(order.number)} ${DONE[to]}`);

  const start = (s: OrderStatus) => {
    if (s === "SHIPPED") setDialog("ship");
    else if (s === "CANCELLED") setDialog("cancel");
    else if (s === "RETURNED") setDialog("return");
    else if (s === "PROCESSING" || s === "DELIVERED") void direct(s);
  };

  const resend = () =>
    void run(
      () => resendOrderEmail({ orderNumber: order.number }),
      (d) => `The “${d.kind}” email is on its way to the customer.`,
    ).then((r) => {
      if (!r.ok && r.fieldErrors) toast.error(r.error);
    });

  const dialogs = canUpdate ? (
    <>
      <ShipDialog open={dialog === "ship"} onOpenChange={(o) => setDialog(o ? "ship" : null)} orders={[dialogOrder]} couriers={couriers} />
      <CancelDialog open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)} orders={[dialogOrder]} />
      <ReturnDialog open={dialog === "return"} onOpenChange={(o) => setDialog(o ? "return" : null)} number={order.number} onConfirm={async () => (await direct("RETURNED")).ok} />
    </>
  ) : null;

  return { primary, secondary, start, resend, pending, dialogs, label: (s: OrderStatus) => transitionLabel(s, order.paymentMethod) };
}
