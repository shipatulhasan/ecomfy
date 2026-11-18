"use client";

import { BanIcon, CheckCircle2Icon, EllipsisIcon, EyeIcon, PackageCheckIcon, PrinterIcon, TruckIcon, Undo2Icon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { changeOrderStatus } from "@/lib/actions/admin-orders";
import { adminOrderHref, orderRef } from "@/lib/admin/orders/params";
import type { OrderStatus } from "@/lib/generated/prisma/enums";
import { adminNextStatuses, transitionLabel } from "@/lib/orders/transitions";
import type { AdminOrderRow } from "@/lib/queries/admin/orders";
import { cn } from "@/lib/utils";
import { CancelDialog, ShipDialog } from "../status-dialogs";
import { useOrderAction } from "../use-order-action";

const icon = "tap-target grid size-8 place-items-center rounded-md text-text-body transition-colors hover:bg-muted hover:text-foreground";

export const STATUS_ICON: Partial<Record<OrderStatus, typeof TruckIcon>> = {
  PROCESSING: CheckCircle2Icon,
  SHIPPED: TruckIcon,
  DELIVERED: PackageCheckIcon,
  RETURNED: Undo2Icon,
  CANCELLED: BanIcon,
};

export const invoiceHref = (number: number) => `/admin/orders/${number}/invoice?print=1`;

const DONE = { PROCESSING: "confirmed", DELIVERED: "marked delivered", RETURNED: "marked returned" } as const;

type Ctx = { canUpdate: boolean; couriers: string[]; returnWindowDays: number };

/**
 * Row "⋯" (not in the PNG): View · the valid next statuses from the transitions
 * map · Print invoice. Below laptop the card's "⋯" opens the same list in a
 * bottom sheet.
 */
export function OrderRowActions({ row, ctx }: { row: AdminOrderRow; ctx: Ctx }) {
  const q = useQuickStatus(row, ctx);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Actions for order ${orderRef(row.number)}`} className={icon} disabled={q.pending} onClick={(e) => e.stopPropagation()}>
          <EllipsisIcon aria-hidden className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem asChild>
            <Link href={adminOrderHref(row.number)}>
              <EyeIcon aria-hidden /> View order
            </Link>
          </DropdownMenuItem>
          {q.next.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-caption text-muted-foreground">Change status</DropdownMenuLabel>
              {q.next.map((s) => {
                const Icon = STATUS_ICON[s] ?? CheckCircle2Icon;
                return (
                  <DropdownMenuItem key={s} variant={s === "CANCELLED" ? "destructive" : "default"} onSelect={() => q.start(s)}>
                    <Icon aria-hidden /> {transitionLabel(s, row.paymentMethod)}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <a href={invoiceHref(row.number)} target="_blank" rel="noreferrer">
              <PrinterIcon aria-hidden /> Print invoice
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {q.dialogs}
    </>
  );
}

export function OrderRowActionsSheet({ row, ctx }: { row: AdminOrderRow; ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  const q = useQuickStatus(row, ctx);
  const item = "tap-target flex w-full items-center gap-3 rounded-lg px-3 py-3 text-lead text-foreground hover:bg-muted disabled:opacity-50";
  const pick = (s: OrderStatus) => () => {
    setOpen(false);
    q.start(s);
  };

  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={`Order ${orderRef(row.number)}`}
        description={row.customer.name}
        closeOnLink
        trigger={
          <button type="button" aria-label={`Actions for order ${orderRef(row.number)}`} className={icon}>
            <EllipsisIcon aria-hidden className="size-5" />
          </button>
        }
      >
        <ul className="flex flex-col py-1">
          <li>
            <Link href={adminOrderHref(row.number)} className={item}>
              <EyeIcon aria-hidden className="size-5" /> View order
            </Link>
          </li>
          {q.next.map((s) => {
            const Icon = STATUS_ICON[s] ?? CheckCircle2Icon;
            return (
              <li key={s}>
                <button type="button" className={cn(item, s === "CANCELLED" && "text-sale")} disabled={q.pending} onClick={pick(s)}>
                  <Icon aria-hidden className="size-5" /> {transitionLabel(s, row.paymentMethod)}
                </button>
              </li>
            );
          })}
          <li>
            <a href={invoiceHref(row.number)} target="_blank" rel="noreferrer" className={item}>
              <PrinterIcon aria-hidden className="size-5" /> Print invoice
            </a>
          </li>
        </ul>
      </BottomSheet>
      {q.dialogs}
    </>
  );
}

/** Status changes from a row: direct for confirm / deliver, a dialog for ship / cancel / return. */
function useQuickStatus(row: AdminOrderRow, ctx: Ctx) {
  const { run, pending } = useOrderAction();
  const [dialog, setDialog] = useState<"ship" | "cancel" | "return" | null>(null);
  const next = ctx.canUpdate ? adminNextStatuses({ status: row.status, deliveredAt: row.deliveredAt, returnWindowDays: ctx.returnWindowDays }) : [];
  const order = { number: row.number, version: row.version, courier: row.courier, trackingNumber: row.trackingNumber, paid: row.paymentStatus === "PAID" };

  const direct = (to: "PROCESSING" | "DELIVERED" | "RETURNED") =>
    run(
      () => changeOrderStatus({ orderNumber: row.number, version: row.version, to }),
      () => `Order ${orderRef(row.number)} ${DONE[to]}`,
    );

  const start = (s: OrderStatus) => {
    if (s === "SHIPPED") setDialog("ship");
    else if (s === "CANCELLED") setDialog("cancel");
    else if (s === "RETURNED") setDialog("return");
    else if (s === "PROCESSING" || s === "DELIVERED") void direct(s);
  };

  const dialogs = ctx.canUpdate ? (
    <>
      <ShipDialog open={dialog === "ship"} onOpenChange={(o) => setDialog(o ? "ship" : null)} orders={[order]} couriers={ctx.couriers} />
      <CancelDialog open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : null)} orders={[order]} />
      <ReturnDialog
        open={dialog === "return"}
        onOpenChange={(o) => setDialog(o ? "return" : null)}
        number={row.number}
        onConfirm={async () => (await direct("RETURNED")).ok}
      />
    </>
  ) : null;

  return { next, start, pending, dialogs };
}

export function ReturnDialog({
  open,
  onOpenChange,
  number,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  number: number;
  onConfirm: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark order {orderRef(number)} returned?</AlertDialogTitle>
          <AlertDialogDescription>
            The items go back into stock. If the customer paid, record the refund on the order afterwards.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep as is</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              setBusy(true);
              const ok = await onConfirm();
              setBusy(false);
              if (ok) onOpenChange(false);
            }}
          >
            {busy ? "Saving…" : "Mark returned"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
