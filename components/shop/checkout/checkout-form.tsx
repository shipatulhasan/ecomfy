"use client";

import { ChevronDownIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useCurrency } from "@/components/shared/currency-provider";
import { FormAlert } from "@/components/shared/form-field";
import { Money } from "@/components/shared/money";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { useCart } from "@/components/shop/cart/cart-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { placeOrder, quoteCheckout } from "@/lib/actions/checkout";
import { EMPTY_CART, type CartView } from "@/lib/cart/pricing";
import type { CheckoutQuote } from "@/lib/checkout/pricing";
import { checkoutCopy } from "@/lib/config/checkout";
import { isDistrict } from "@/lib/config/districts";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addressSchema } from "@/lib/validations/address";
import { AddressFields, EMPTY_ADDRESS, type AddressState } from "./address-fields";
import { CheckoutStep } from "./checkout-step";
import { SummaryItems, SummaryTotals } from "./order-summary";
import { PaymentMethods } from "./payment-methods";

type Step = "address" | "delivery" | "payment";
type Errors = Record<string, string | undefined>;

/**
 * Checkout form (Checkout.png). Laptop+: billing form + "Additional Info" on the
 * left, the 424 "Order Summery" card with payment methods and Place Order on the
 * right. Below laptop: "Show order summary" row, then steps 1 Address →
 * 2 Delivery → 3 Payment, and a sticky bar with the total and the method's label.
 *
 * Totals are always the server's: the district / method change asks
 * `quoteCheckout`, and `placeOrder` recomputes everything again. The payment
 * methods and the place-order button exist once per layout (laptop card vs
 * step 3 / sticky bar), switched by CSS only.
 */
export function CheckoutForm({
  cart,
  initialQuote,
  initialAddress,
  signedIn,
  codFeeCents,
}: {
  cart: CartView;
  initialQuote: CheckoutQuote;
  initialAddress: AddressState | null;
  signedIn: boolean;
  codFeeCents: number;
}) {
  const router = useRouter();
  const { hydrate } = useCart();
  const { currency } = useCurrency();
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [billing, setBilling] = useState<AddressState>(initialAddress ?? EMPTY_ADDRESS);
  const [shipDifferent, setShipDifferent] = useState(false);
  const [shipping, setShipping] = useState<AddressState>(EMPTY_ADDRESS);
  const [notes, setNotes] = useState("");
  const [saveAddress, setSaveAddress] = useState(signedIn && !initialAddress);
  const [method, setMethod] = useState<PaymentMethod>(initialQuote.paymentMethod);
  const [quote, setQuote] = useState(initialQuote);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const prefilledOk = initialAddress ? addressSchema.safeParse(initialAddress).success : false;
  const [step, setStep] = useState<Step>(prefilledOk ? "payment" : "address");
  const [done, setDone] = useState<Record<Step, boolean>>({ address: prefilledOk, delivery: prefilledOk, payment: false });
  const [summaryOpen, setSummaryOpen] = useState(false);

  const [quoting, startQuote] = useTransition();
  const [placing, startPlace] = useTransition();
  const submitting = useRef(false);
  const quoteSeq = useRef(0);

  const shipDistrict = (shipDifferent ? shipping.district : billing.district) || null;

  function requote(district: string | null, m: PaymentMethod) {
    const seq = ++quoteSeq.current;
    startQuote(async () => {
      const res = await quoteCheckout({ district: isDistrict(district) ? district : null, paymentMethod: m });
      if (seq !== quoteSeq.current) return; // a newer change won
      if (res.ok) {
        setQuote(res.data);
        // The chosen method became unavailable (e.g. COD in a disallowed district).
        if (!res.data.methods[m].enabled) {
          const fallback = (["BKASH", "SSLCOMMERZ", "COD"] as const).find((x) => res.data.methods[x].enabled);
          if (fallback && fallback !== m) {
            setMethod(fallback);
            requote(district, fallback);
          }
        }
      }
    });
  }

  function updateAddress(which: "billing" | "shipping", field: keyof AddressState, v: string) {
    const set = which === "billing" ? setBilling : setShipping;
    set((prev) => ({ ...prev, [field]: v }));
    setErrors((e) => ({ ...e, [`${which}.${field}`]: undefined }));
    if (field === "district" && (which === "shipping") === shipDifferent) requote(v, method);
  }

  function toggleShipDifferent(on: boolean) {
    setShipDifferent(on);
    requote((on ? shipping.district : billing.district) || null, method);
  }

  function chooseMethod(m: PaymentMethod) {
    setMethod(m);
    requote(shipDistrict, m);
  }

  function validateAddresses(): boolean {
    const next: Errors = {};
    const check = (which: "billing" | "shipping", a: AddressState) => {
      const parsed = addressSchema.safeParse(which === "shipping" ? { ...a, email: billing.email } : a);
      if (!parsed.success) for (const issue of parsed.error.issues) next[`${which}.${String(issue.path[0])}`] ??= issue.message;
    };
    check("billing", billing);
    if (shipDifferent) check("shipping", shipping);
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) document.getElementById(first.replace(".", "-"))?.focus();
    return !first;
  }

  function continueFrom(s: Step) {
    if (s === "address" && !validateAddresses()) return;
    setDone((d) => ({ ...d, [s]: true }));
    setStep(s === "address" ? "delivery" : "payment");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return; // double click / double tap
    setFormError(null);
    if (!validateAddresses()) {
      setStep("address");
      return;
    }
    if (!quote.methods[method].enabled) {
      setFormError(quote.methods[method].reason ?? checkoutCopy.methodOff);
      return;
    }
    submitting.current = true;
    startPlace(async () => {
      const res = await placeOrder({
        idempotencyKey,
        billing,
        shipToDifferentAddress: shipDifferent,
        shipping: shipDifferent ? { ...shipping, email: billing.email } : undefined,
        notes,
        paymentMethod: method,
        saveAddress: signedIn && saveAddress,
        displayCurrency: currency,
      });
      if (!res.ok) {
        submitting.current = false;
        setFormError(res.error);
        toast.error(res.error);
        return;
      }
      const r = res.data;
      if (r.kind === "gateway") {
        // Stay "pending" while the browser leaves for the gateway.
        window.location.assign(r.url);
        return;
      }
      if (r.kind === "cart") {
        toast.error(r.message);
        router.push(r.href);
        return;
      }
      if (r.message) toast.error(r.message);
      if (r.cleared) hydrate(EMPTY_CART);
      router.replace(r.href);
    });
  }

  const total = quote.totalCents;
  const buttonLabel = checkoutCopy.button[method](formatPrice(total));
  const pendingLabel = method === "COD" ? checkoutCopy.placing : checkoutCopy.redirecting;
  const busy = placing;
  const zoneLine = quote.zone ? `${quote.zone.name} · ${quote.zone.etaText}` : null;
  const addrSummary = [billing.firstName && `${billing.firstName} ${billing.lastName}`, billing.city, billing.district]
    .filter(Boolean)
    .join(", ");

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-busy={busy || undefined}
      className="grid items-start gap-4 tablet:gap-6 laptop:grid-cols-[minmax(0,1fr)_26.5rem]"
    >
      {/* Below laptop: collapsed order summary at the top. */}
      <div className="rounded-lg border border-border bg-card laptop:hidden">
        <button
          type="button"
          onClick={() => setSummaryOpen((o) => !o)}
          aria-expanded={summaryOpen}
          aria-controls="checkout-mobile-summary"
          className="press flex min-h-14 w-full items-center gap-2 px-4 text-left text-copy text-foreground"
        >
          <span className="flex-1 font-medium text-primary">
            {summaryOpen ? checkoutCopy.hideSummary : checkoutCopy.showSummary}
          </span>
          <ChevronDownIcon aria-hidden className={cn("size-4 text-primary transition-transform", summaryOpen && "rotate-180")} />
          <Money cents={total} className="font-semibold" />
        </button>
        <div id="checkout-mobile-summary" hidden={!summaryOpen} className="border-t border-border px-4 pb-4">
          <div className="pt-3">
            <SummaryItems lines={cart.lines} />
          </div>
          <SummaryTotals quote={quote} className="mt-2" />
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-4 tablet:gap-6 laptop:gap-0">
        <CheckoutStep
          index={1}
          title={checkoutCopy.steps.address}
          open={step === "address"}
          done={done.address}
          summary={addrSummary}
          onEdit={() => setStep("address")}
        >
          <h2 className="mb-5 hidden text-h2 font-medium text-foreground laptop:block">{checkoutCopy.billingTitle}</h2>
          <AddressFields section="billing" value={billing} onChange={(f, v) => updateAddress("billing", f, v)} errors={errors} />

          <div className="mt-5 flex flex-col gap-3">
            <Label className="tap-target w-fit gap-2 text-copy font-normal text-text-body">
              <Checkbox checked={shipDifferent} onCheckedChange={(c) => toggleShipDifferent(c === true)} />
              {checkoutCopy.shipDifferent}
            </Label>
            {signedIn && (
              <Label className="tap-target w-fit gap-2 text-copy font-normal text-text-body">
                <Checkbox checked={saveAddress} onCheckedChange={(c) => setSaveAddress(c === true)} />
                {checkoutCopy.saveAddress}
              </Label>
            )}
          </div>

          {shipDifferent && (
            <div className="mt-6">
              <h3 className="mb-4 text-h4 font-medium text-foreground">{checkoutCopy.shippingTitle}</h3>
              <AddressFields
                section="shipping"
                value={shipping}
                onChange={(f, v) => updateAddress("shipping", f, v)}
                errors={errors}
                withEmail={false}
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => continueFrom("address")}
            className="press mt-6 flex h-12 w-full items-center justify-center rounded-full bg-primary text-copy font-semibold text-primary-foreground laptop:hidden"
          >
            {checkoutCopy.continue}
          </button>
        </CheckoutStep>

        <hr className="my-8 hidden border-border laptop:block" />

        <CheckoutStep
          index={2}
          title={checkoutCopy.steps.delivery}
          open={step === "delivery"}
          done={done.delivery}
          summary={zoneLine}
          onEdit={() => setStep("delivery")}
        >
          <div className="mb-4 rounded-md bg-secondary px-4 py-3 text-copy text-brand-dark laptop:hidden" aria-live="polite">
            {quote.zone ? (
              <>
                <p className="font-medium">
                  {checkoutCopy.deliveryTo(quote.zone.name)} ·{" "}
                  {quote.shippingCents ? <Money cents={quote.shippingCents} /> : checkoutCopy.free}
                </p>
                <p className="text-caption">{checkoutCopy.eta(quote.zone.etaText)}</p>
              </>
            ) : (
              <p>Choose your district in step 1 to see delivery options.</p>
            )}
          </div>
          <h2 className="mb-5 hidden text-h2 font-medium text-foreground laptop:block">{checkoutCopy.additionalTitle}</h2>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="checkout-notes" className="text-copy text-foreground">
              {checkoutCopy.notesLabel}
            </label>
            <textarea
              id="checkout-notes"
              name="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={checkoutCopy.notesPlaceholder}
              className="min-h-25 w-full rounded-md border border-border bg-background px-4 py-3 text-lead text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15"
            />
          </div>
          <button
            type="button"
            onClick={() => continueFrom("delivery")}
            className="press mt-6 flex h-12 w-full items-center justify-center rounded-full bg-primary text-copy font-semibold text-primary-foreground laptop:hidden"
          >
            {checkoutCopy.continue}
          </button>
        </CheckoutStep>

        {/* Below laptop: step 3. (Laptop: the methods live in the summary card.) */}
        <CheckoutStep
          index={3}
          title={checkoutCopy.steps.payment}
          open={step === "payment"}
          done={false}
          onEdit={() => setStep("payment")}
          className="laptop:hidden"
        >
          <PaymentMethods value={method} onChange={chooseMethod} quote={quote} codFeeCents={codFeeCents} idPrefix="m" />
          {formError && <FormAlert tone="error" className="mt-4">{formError}</FormAlert>}
        </CheckoutStep>
      </div>

      {/* Laptop+: the Checkout.png "Order Summery" card. */}
      <aside className="hidden rounded-lg border border-border bg-card p-6 laptop:block" aria-label={checkoutCopy.summaryTitle}>
        <h2 className="text-h4 font-medium text-foreground">{checkoutCopy.summaryTitle}</h2>
        <div className="mt-3">
          <SummaryItems lines={cart.lines} />
        </div>
        <SummaryTotals quote={quote} className={cn("mt-3 transition-opacity", quoting && "opacity-60")} />

        <h2 className="mt-6 text-h4 font-medium text-foreground">{checkoutCopy.paymentTitle}</h2>
        <div className="mt-4">
          <PaymentMethods value={method} onChange={chooseMethod} quote={quote} codFeeCents={codFeeCents} idPrefix="d" />
        </div>
        {formError && <FormAlert tone="error" className="mt-4">{formError}</FormAlert>}
        <button
          type="submit"
          disabled={busy || quoting}
          aria-busy={busy || undefined}
          className={cn(
            "press mt-6 flex h-12.75 w-full items-center justify-center rounded-full bg-primary px-6 text-lead font-semibold text-primary-foreground transition-colors hover:bg-brand-dark disabled:opacity-75",
            busy && "animate-pulse",
          )}
        >
          {busy ? pendingLabel : buttonLabel}
        </button>
      </aside>

      {/* Below laptop: total + method label above the home indicator (no tab bar on checkout). */}
      <StickyActionBar>
        <div className="flex min-w-0 flex-col">
          <span className="text-caption text-muted-foreground">{checkoutCopy.total.replace(":", "")}</span>
          <Money cents={total} className={cn("text-lead font-semibold text-foreground", quoting && "opacity-60")} />
        </div>
        <button
          type="submit"
          disabled={busy || quoting}
          aria-busy={busy || undefined}
          className={cn(
            "press ml-auto flex h-12 min-w-0 flex-1 items-center justify-center rounded-full bg-primary px-4 text-center text-copy leading-tight font-semibold text-primary-foreground disabled:opacity-75",
            busy && "animate-pulse",
          )}
        >
          <span className="line-clamp-2">{busy ? pendingLabel : buttonLabel}</span>
        </button>
      </StickyActionBar>
    </form>
  );
}
