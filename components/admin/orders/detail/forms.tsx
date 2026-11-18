"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field, fieldInput } from "@/components/admin/products/form/fields";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import { Button } from "@/components/ui/button";
import { addInternalNote, recordRefund, updateShipping } from "@/lib/actions/admin-orders";
import { formatPrice } from "@/lib/money";
import { ADMIN_ORDER_LIMITS } from "@/lib/validations/admin-order";
import { cn } from "@/lib/utils";
import { CourierSelect } from "../status-dialogs";
import { useOrderAction } from "../use-order-action";

/** Copy a value (phone, address) with a short "Copied" state. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Couldn't copy. Select the text instead.");
        }
      }}
      className={cn("tap-target grid size-8 shrink-0 place-items-center rounded-md text-text-body transition-colors hover:bg-muted hover:text-foreground", className)}
    >
      {done ? <CheckIcon aria-hidden className="size-4 text-success" /> : <CopyIcon aria-hidden className="size-4" />}
      <span aria-live="polite" className="sr-only">
        {done ? "Copied" : ""}
      </span>
    </button>
  );
}

// ───────────────────────────── shipping card ─────────────────────────────

/** Courier + tracking, editable while PROCESSING / SHIPPED (prefills "Mark shipped"). */
export function ShippingForm({
  order,
  couriers,
}: {
  order: { number: number; version: number; courier: string | null; trackingNumber: string | null; trackingUrl: string | null };
  couriers: string[];
}) {
  const { run, pending } = useOrderAction();
  const [courier, setCourier] = useState(order.courier ?? "");
  const [tracking, setTracking] = useState(order.trackingNumber ?? "");
  const [url, setUrl] = useState(order.trackingUrl ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dirty = courier !== (order.courier ?? "") || tracking !== (order.trackingNumber ?? "") || url !== (order.trackingUrl ?? "");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const res = await run(
      () => updateShipping({ orderNumber: order.number, version: order.version, courier, trackingNumber: tracking, trackingUrl: url }),
      () => "Shipping details saved",
    );
    if (!res.ok && res.fieldErrors) {
      setErrors(Object.fromEntries(Object.entries(res.fieldErrors).flatMap(([k, v]) => (v?.[0] ? [[k, v[0]]] : []))));
    }
  };

  return (
    <form onSubmit={save} className="mt-4 flex flex-col gap-4">
      <Field id="shipping-courier" label="Courier" error={errors.courier}>
        <CourierSelect id="shipping-courier" value={courier} couriers={couriers} onChange={setCourier} invalid={!!errors.courier} />
      </Field>
      <Field id="shipping-tracking" label="Tracking number" error={errors.trackingNumber}>
        <input
          id="shipping-tracking"
          value={tracking}
          maxLength={ADMIN_ORDER_LIMITS.tracking}
          onChange={(e) => setTracking(e.target.value)}
          aria-invalid={!!errors.trackingNumber || undefined}
          className={fieldInput}
          autoComplete="off"
        />
      </Field>
      <Field
        id="shipping-url"
        label={
          <>
            Tracking link <span className="font-normal text-muted-foreground">(Optional)</span>
          </>
        }
        error={errors.trackingUrl}
      >
        <input
          id="shipping-url"
          type="url"
          inputMode="url"
          placeholder="https://"
          value={url}
          maxLength={ADMIN_ORDER_LIMITS.url}
          onChange={(e) => setUrl(e.target.value)}
          aria-invalid={!!errors.trackingUrl || undefined}
          className={fieldInput}
        />
      </Field>
      <Button type="submit" size="lg" variant="outline" className="h-11" disabled={pending || !dirty}>
        {pending ? "Saving…" : "Save shipping details"}
      </Button>
    </form>
  );
}

// ───────────────────────────── timeline ─────────────────────────────

/** Timeline → "Add internal note" (staff only, never shown to the customer). */
export function NoteForm({ number }: { number: number }) {
  const { run, pending } = useOrderAction();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const res = await run(() => addInternalNote({ orderNumber: number, note }), () => "Note added", () => setNote(""));
        if (!res.ok && res.fieldErrors?.note) setError(res.fieldErrors.note[0] ?? null);
      }}
      className="mt-5 flex flex-col gap-3 border-t border-border pt-5"
    >
      <label htmlFor="internal-note" className="text-lead font-medium text-foreground">
        Add internal note <span className="font-normal text-muted-foreground">(staff only)</span>
      </label>
      <textarea
        id="internal-note"
        rows={3}
        value={note}
        maxLength={ADMIN_ORDER_LIMITS.note}
        onChange={(e) => setNote(e.target.value)}
        aria-invalid={!!error || undefined}
        placeholder="Called the customer, asked to deliver after 5 pm…"
        className={cn(fieldInput, "h-auto py-3")}
      />
      {error && <p className="text-caption text-destructive">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption text-muted-foreground">
          {note.length}/{ADMIN_ORDER_LIMITS.note}
        </span>
        <Button type="submit" size="lg" className="h-11 px-5" disabled={pending || !note.trim()}>
          {pending ? "Adding…" : "Add note"}
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────────── refund ─────────────────────────────

/** Payment card → "Mark as refunded": a manual refund (amount + note). orders:refund. */
export function RefundButton({ number, version, leftCents }: { number: number; version: number; leftCents: number }) {
  const { run, pending } = useOrderAction();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onOpenChange = (o: boolean) => {
    if (pending) return;
    if (o) {
      setAmount((leftCents / 100).toFixed(2));
      setNote("");
      setErrors({});
    }
    setOpen(o);
  };

  const submit = async () => {
    setErrors({});
    const res = await run(
      () => recordRefund({ orderNumber: number, version, amount, note }),
      (d) => `Refund recorded. ${formatPrice(d.refundedCents)} refunded in total.`,
    );
    if (res.ok) setOpen(false);
    else if (res.fieldErrors) setErrors(Object.fromEntries(Object.entries(res.fieldErrors).flatMap(([k, v]) => (v?.[0] ? [[k, v[0]]] : []))));
  };

  return (
    <>
      <Button size="lg" variant="outline" className="h-11 w-full" onClick={() => onOpenChange(true)}>
        Mark as refunded
      </Button>
      <ResponsiveModal
        open={open}
        onOpenChange={onOpenChange}
        title={`Refund order #${number}`}
        description="Record a refund you've already sent (bKash, bank transfer, cash). No money is moved from here."
        className="laptop:max-w-140"
        footer={
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" className="h-11 px-4" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" className="h-11 min-w-35 px-4" disabled={pending} onClick={submit}>
              {pending ? "Saving…" : "Record refund"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <Field id="refund-amount" label="Amount (৳)" hint={`Up to ${formatPrice(leftCents)}. The full amount marks the payment Refunded.`} error={errors.amount}>
            <input
              id="refund-amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-invalid={!!errors.amount || undefined}
              className={fieldInput}
            />
          </Field>
          <Field id="refund-note" label="Note" hint="How and when it was refunded, with the reference." error={errors.note}>
            <textarea
              id="refund-note"
              rows={3}
              value={note}
              maxLength={ADMIN_ORDER_LIMITS.note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={!!errors.note || undefined}
              className={cn(fieldInput, "h-auto py-3")}
            />
          </Field>
        </div>
      </ResponsiveModal>
    </>
  );
}
