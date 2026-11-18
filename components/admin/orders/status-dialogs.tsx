"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Field, fieldInput } from "@/components/admin/products/form/fields";
import { dropdownClass } from "@/components/admin/products/form/pickers";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { bulkChangeStatus, changeOrderStatus, type BulkReport } from "@/lib/actions/admin-orders";
import { orderRef } from "@/lib/admin/orders/params";
import { ADMIN_ORDER_LIMITS } from "@/lib/validations/admin-order";
import { cn } from "@/lib/utils";
import { useOrderAction } from "./use-order-action";

/**
 * Dialogs for the status changes that need input: Mark shipped (courier +
 * tracking per order) and Cancel (reason). One order → changeOrderStatus;
 * several → bulkChangeStatus, which reports per order. Shared by the list (row
 * menu, bulk bar) and the detail page.
 */

export type DialogOrder = { number: number; version: number; courier?: string | null; trackingNumber?: string | null; paid?: boolean };

/** "3 updated, 1 skipped: <ref> already delivered" (ref = orderRef()). */
export function formatReport(r: BulkReport): string {
  const head = `${r.updated.length} updated`;
  if (!r.skipped.length) return head;
  const list = r.skipped.map((s) => `${orderRef(s.number)} ${s.reason}`).join("; ");
  return `${head}, ${r.skipped.length} skipped: ${list}`;
}

/** Counts only: the list's report banner names each skipped order. */
export function reportToast(r: BulkReport) {
  const msg = r.skipped.length ? `${r.updated.length} updated, ${r.skipped.length} skipped` : `${r.updated.length} updated`;
  if (r.skipped.length && !r.updated.length) toast.error(msg);
  else if (r.skipped.length) toast.warning(msg);
  else toast.success(msg);
}

// ───────────────────────────── ship ─────────────────────────────

type Row = { courier: string; trackingNumber: string; trackingUrl: string };

export function ShipDialog({
  open,
  onOpenChange,
  orders,
  couriers,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: DialogOrder[];
  couriers: string[];
  onDone?: (report: BulkReport | null) => void;
}) {
  const { run, pending } = useOrderAction();
  const [rows, setRows] = useState<Record<number, Row>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const single = orders.length === 1;

  // Start from what the orders already have (Shipping card prefill) each time it opens.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const key = open ? orders.map((o) => `${o.number}:${o.version}`).join(",") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setRows(Object.fromEntries(orders.map((o) => [o.number, { courier: o.courier ?? "", trackingNumber: o.trackingNumber ?? "", trackingUrl: "" }])));
      setErrors({});
    }
  }

  const set = (n: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [n]: { ...r[n]!, ...patch } }));
  const setAllCouriers = (courier: string) => setRows((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { ...v, courier }])));

  const submit = async () => {
    setErrors({});
    if (single) {
      const o = orders[0]!;
      const row = rows[o.number]!;
      const res = await run(
        () => changeOrderStatus({ orderNumber: o.number, version: o.version, to: "SHIPPED", ...row }),
        () => `Order ${orderRef(o.number)} marked shipped. The customer will get an email.`,
      );
      if (res.ok) {
        onOpenChange(false);
        onDone?.(null);
      } else if (res.fieldErrors) {
        setErrors(flat(res.fieldErrors, (k) => `${o.number}.${k}`));
      }
      return;
    }
    const items = orders.map((o) => ({ orderNumber: o.number, version: o.version, ...rows[o.number]! }));
    const res = await run(() => bulkChangeStatus({ to: "SHIPPED", items }), null);
    if (res.ok) {
      reportToast(res.data);
      onOpenChange(false);
      onDone?.(res.data);
    } else if (res.fieldErrors) {
      setErrors(
        flat(res.fieldErrors, (k) => {
          const m = /^items\.(\d+)\.(\w+)$/.exec(k);
          return m ? `${orders[Number(m[1])]?.number}.${m[2]}` : k;
        }),
      );
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(o) => !pending && onOpenChange(o)}
      title={single ? `Mark ${orderRef(orders[0]!.number)} shipped` : `Mark ${orders.length} orders shipped`}
      description="Courier and tracking number are required. The customer gets an email with the tracking details."
      className={single ? "laptop:max-w-140" : "laptop:max-w-200"}
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" className="h-11 px-4" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="h-11 min-w-35 px-4" disabled={pending} onClick={submit}>
            {pending ? "Saving…" : single ? "Mark shipped" : `Mark ${orders.length} shipped`}
          </Button>
        </div>
      }
    >
      {single ? (
        <SingleShipForm order={orders[0]!} row={rows[orders[0]!.number]} couriers={couriers} errors={errors} onChange={(p) => set(orders[0]!.number, p)} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-copy text-text-body">Same courier for all:</span>
            <CourierSelect id="ship-all-courier" value="" couriers={couriers} onChange={setAllCouriers} className="h-11 w-48" placeholder="Choose…" />
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-140 text-left text-copy">
              <thead className="bg-secondary">
                <tr className="h-11">
                  <th scope="col" className="px-3 font-medium">
                    Order
                  </th>
                  <th scope="col" className="px-3 font-medium">
                    Courier
                  </th>
                  <th scope="col" className="px-3 font-medium">
                    Tracking number
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((o) => {
                  const row = rows[o.number];
                  if (!row) return null;
                  const cErr = errors[`${o.number}.courier`];
                  const tErr = errors[`${o.number}.trackingNumber`];
                  return (
                    <tr key={o.number} className="align-top">
                      <td className="px-3 py-3 font-medium whitespace-nowrap">{orderRef(o.number)}</td>
                      <td className="px-3 py-2">
                        <CourierSelect
                          id={`ship-${o.number}-courier`}
                          value={row.courier}
                          couriers={couriers}
                          onChange={(courier) => set(o.number, { courier })}
                          invalid={!!cErr}
                          className="h-11"
                          label={`Courier for ${orderRef(o.number)}`}
                        />
                        {cErr && <p className="mt-1 text-caption text-destructive">{cErr}</p>}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          aria-label={`Tracking number for ${orderRef(o.number)}`}
                          value={row.trackingNumber}
                          maxLength={ADMIN_ORDER_LIMITS.tracking}
                          onChange={(e) => set(o.number, { trackingNumber: e.target.value })}
                          aria-invalid={!!tErr || undefined}
                          className={cn(fieldInput, "h-11")}
                          autoComplete="off"
                        />
                        {tErr && <p className="mt-1 text-caption text-destructive">{tErr}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-caption text-muted-foreground">Orders that can&apos;t be shipped (not confirmed yet, already shipped…) are skipped and listed afterwards.</p>
        </div>
      )}
    </ResponsiveModal>
  );
}

function SingleShipForm({
  order,
  row,
  couriers,
  errors,
  onChange,
}: {
  order: DialogOrder;
  row: Row | undefined;
  couriers: string[];
  errors: Record<string, string>;
  onChange: (patch: Partial<Row>) => void;
}) {
  if (!row) return null;
  const err = (k: string) => errors[`${order.number}.${k}`];
  return (
    <div className="flex flex-col gap-5">
      <Field id="ship-courier" label="Courier" error={err("courier")}>
        <CourierSelect id="ship-courier" value={row.courier} couriers={couriers} onChange={(courier) => onChange({ courier })} invalid={!!err("courier")} />
      </Field>
      <Field id="ship-tracking" label="Tracking number" error={err("trackingNumber")}>
        <input
          id="ship-tracking"
          value={row.trackingNumber}
          maxLength={ADMIN_ORDER_LIMITS.tracking}
          onChange={(e) => onChange({ trackingNumber: e.target.value })}
          aria-invalid={!!err("trackingNumber") || undefined}
          className={fieldInput}
          autoComplete="off"
        />
      </Field>
      <Field
        id="ship-link"
        label={
          <>
            Tracking link <span className="font-normal text-muted-foreground">(Optional)</span>
          </>
        }
        hint="Filled in from the courier's tracking page when one is set up."
        error={err("trackingUrl")}
      >
        <input
          id="ship-link"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={row.trackingUrl}
          maxLength={ADMIN_ORDER_LIMITS.url}
          onChange={(e) => onChange({ trackingUrl: e.target.value })}
          aria-invalid={!!err("trackingUrl") || undefined}
          className={fieldInput}
        />
      </Field>
    </div>
  );
}

export function CourierSelect({
  id,
  value,
  couriers,
  onChange,
  invalid,
  className,
  placeholder = "Select a courier",
  label,
  disabled,
}: {
  id: string;
  value: string;
  couriers: string[];
  onChange: (v: string) => void;
  invalid?: boolean;
  className?: string;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}) {
  // Keep a courier that's no longer in Settings selectable on old orders.
  const options = value && !couriers.includes(value) ? [value, ...couriers] : couriers;
  return (
    <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} aria-label={label} aria-invalid={invalid || undefined} className={cn(dropdownClass, className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ───────────────────────────── cancel ─────────────────────────────

const REASONS = ["Customer asked to cancel", "Couldn't reach the customer", "Out of stock", "Suspected fake order", "Duplicate order"];

export function CancelDialog({
  open,
  onOpenChange,
  orders,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: DialogOrder[];
  onDone?: (report: BulkReport | null) => void;
}) {
  const { run, pending } = useOrderAction();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const single = orders.length === 1;
  const paid = orders.filter((o) => o.paid).length;

  const close = (o: boolean) => {
    if (pending) return;
    if (!o) {
      setReason("");
      setError(null);
    }
    onOpenChange(o);
  };

  const submit = async () => {
    if (!reason.trim()) {
      setError("Enter a reason");
      return;
    }
    setError(null);
    if (single) {
      const o = orders[0]!;
      const res = await run(
        () => changeOrderStatus({ orderNumber: o.number, version: o.version, to: "CANCELLED", reason }),
        () => `Order ${orderRef(o.number)} cancelled. Stock was put back.`,
      );
      if (res.ok) {
        close(false);
        onDone?.(null);
      } else if (res.fieldErrors?.reason) setError(res.fieldErrors.reason[0] ?? null);
      return;
    }
    const res = await run(() => bulkChangeStatus({ to: "CANCELLED", reason, items: orders.map((o) => ({ orderNumber: o.number, version: o.version })) }), null);
    if (res.ok) {
      reportToast(res.data);
      close(false);
      onDone?.(res.data);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={close}
      title={single ? `Cancel order ${orderRef(orders[0]!.number)}?` : `Cancel ${orders.length} orders?`}
      description="Reserved or shipped stock goes back to inventory and the customer gets an email. This can't be undone."
      className="laptop:max-w-140"
      footer={
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" className="h-11 px-4" disabled={pending} onClick={() => close(false)}>
            Keep order{single ? "" : "s"}
          </Button>
          <Button type="button" variant="destructive" className="h-11 min-w-35 px-4" disabled={pending} onClick={submit}>
            {pending ? "Cancelling…" : single ? "Cancel order" : `Cancel ${orders.length} orders`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {paid > 0 && (
          <p role="note" className="rounded-lg bg-warning-soft px-4 py-3 text-copy text-warning-strong">
            {single ? "This order is paid." : `${paid} of these orders are paid.`} Cancelling doesn&apos;t refund the money: record the refund on the order
            afterwards.
          </p>
        )}
        <Field id="cancel-reason" label="Reason" error={error ?? undefined} hint="Shown to the customer in the cancellation email.">
          <input
            id="cancel-reason"
            value={reason}
            maxLength={ADMIN_ORDER_LIMITS.reason}
            onChange={(e) => setReason(e.target.value)}
            aria-invalid={!!error || undefined}
            className={fieldInput}
            autoComplete="off"
          />
        </Field>
        <ul aria-label="Common reasons" className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <li key={r}>
              <button
                type="button"
                onClick={() => setReason(r)}
                className={cn(
                  "tap-target rounded-full border px-3 py-1 text-caption transition-colors",
                  reason === r ? "border-primary bg-secondary text-secondary-foreground" : "border-border text-text-body hover:bg-muted",
                )}
              >
                {r}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ResponsiveModal>
  );
}

function flat(fieldErrors: Record<string, string[] | undefined>, key: (k: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fieldErrors)) if (v?.[0]) out[key(k)] = v[0];
  return out;
}
