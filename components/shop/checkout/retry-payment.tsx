"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/shared/form-field";
import { useCart } from "@/components/shop/cart/cart-provider";
import { retryPayment } from "@/lib/actions/checkout";
import { EMPTY_CART } from "@/lib/cart/pricing";
import type { CheckoutQuote } from "@/lib/checkout/pricing";
import { checkoutCopy, resultCopy } from "@/lib/config/checkout";
import type { PaymentMethod } from "@/lib/generated/prisma/enums";
import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PaymentMethods } from "./payment-methods";

/**
 * /checkout/failed: "Try again" (a new attempt with the same method on the SAME
 * order) or "Change method" (including Cash on Delivery when it's allowed).
 */
export function RetryPayment({
  orderId,
  method: current,
  quote,
  codFeeCents,
}: {
  orderId: string;
  method: PaymentMethod;
  /** Availability for this order (COD rules) and the base total. */
  quote: CheckoutQuote;
  codFeeCents: number;
}) {
  const router = useRouter();
  const { hydrate } = useCart();
  const [changing, setChanging] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const busy = useRef(false);

  const totalFor = (m: PaymentMethod) => quote.totalCents - quote.codFeeCents + (m === "COD" ? codFeeCents : 0);
  const shown: CheckoutQuote = { ...quote, totalCents: totalFor(method), codFeeCents: method === "COD" ? codFeeCents : 0 };

  function go(m: PaymentMethod) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    start(async () => {
      const res = await retryPayment({ orderId, paymentMethod: m });
      if (!res.ok) {
        busy.current = false;
        setError(res.error);
        return;
      }
      const r = res.data;
      if (r.kind === "gateway") {
        window.location.assign(r.url);
        return;
      }
      if (r.kind === "cart") {
        toast.error(r.message);
        router.push(r.href);
        return;
      }
      busy.current = false;
      if (r.message) setError(r.message);
      if (r.cleared) hydrate(EMPTY_CART);
      router.replace(r.href);
      router.refresh();
    });
  }

  const pill =
    "press inline-flex h-12 items-center justify-center rounded-full px-8 text-copy font-semibold transition-colors disabled:opacity-75";

  return (
    <div className="flex flex-col gap-4">
      {!changing ? (
        <div className="flex flex-col gap-3 tablet:flex-row">
          <button
            type="button"
            disabled={pending || !quote.methods[current].enabled}
            onClick={() => go(current)}
            className={cn(pill, "bg-primary text-primary-foreground hover:bg-brand-dark", pending && "animate-pulse")}
          >
            {pending ? checkoutCopy.redirecting : resultCopy.tryAgain}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setChanging(true)}
            className={cn(pill, "border border-primary text-primary hover:bg-secondary")}
          >
            {resultCopy.changeMethod}
          </button>
        </div>
      ) : (
        <>
          <PaymentMethods value={method} onChange={setMethod} quote={shown} codFeeCents={codFeeCents} idPrefix="retry" />
          <button
            type="button"
            disabled={pending || !quote.methods[method].enabled}
            onClick={() => go(method)}
            className={cn(pill, "bg-primary text-primary-foreground hover:bg-brand-dark", pending && "animate-pulse")}
          >
            {pending
              ? method === "COD"
                ? checkoutCopy.placing
                : checkoutCopy.redirecting
              : checkoutCopy.button[method](formatPrice(totalFor(method)))}
          </button>
        </>
      )}
      {error && <FormAlert tone="error">{error}</FormAlert>}
    </div>
  );
}
