"use client";

import { TicketPercentIcon } from "lucide-react";
import { useId, useState, useTransition } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { couponMinimumProblem } from "@/lib/cart/pricing";
import { cartCopy } from "@/lib/config/cart";
import { Money } from "@/components/shared/money";
import { useCurrency } from "@/components/shared/currency-provider";
import { cn } from "@/lib/utils";
import { useCart } from "./cart-provider";

/**
 * Shopping Cart "Coupon Code" (Figma 460:42618, 872×92): title, then a pill input
 * with the dark "Apply Coupon" button over its right end. Errors (invalid, expired,
 * minimum not met) show inline under the field. Once applied, the field becomes a
 * chip with "Remove". Below laptop the same form sits in a collapsible row.
 */
export function CouponCard() {
  return (
    <>
      <section
        aria-label={cartCopy.couponTitle}
        className="hidden items-start gap-6 rounded-lg border border-border bg-card p-5 laptop:flex"
      >
        <h2 className="flex h-13 shrink-0 items-center text-h4 font-medium text-foreground">{cartCopy.couponTitle}</h2>
        <CouponBody className="flex-1" />
      </section>
      <Accordion type="single" collapsible className="rounded-lg border border-border bg-card px-4 laptop:hidden">
        <AccordionItem value="coupon">
          <AccordionTrigger className="items-center py-3.5 text-copy font-medium text-foreground hover:no-underline">
            <span className="flex items-center gap-2">
              <TicketPercentIcon aria-hidden className="size-5 text-primary" />
              {cartCopy.couponMobile}
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <CouponBody />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </>
  );
}

function CouponBody({ className }: { className?: string }) {
  const { cart, applyCoupon, removeCoupon } = useCart();
  const { format } = useCurrency();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inputId = useId();
  const errorId = useId();

  const coupon = cart.coupon;
  if (coupon) {
    const problem = coupon.error ?? couponMinimumProblem(coupon, cart.totals.subtotalCents, format);
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div className="flex min-h-13 items-center justify-between gap-3 rounded-full border border-dashed border-primary bg-secondary px-6">
          <p className="text-copy text-brand-dark">
            <span className="font-semibold">{coupon.code}</span>
            {!problem && cart.totals.discountCents > 0 && <> · −<Money cents={cart.totals.discountCents} /></>}
          </p>
          <button
            type="button"
            onClick={removeCoupon}
            className="press tap-target text-copy font-semibold text-sale hover:underline"
          >
            {cartCopy.removeCoupon}
          </button>
        </div>
        {problem && (
          <p role="alert" className="px-6 text-caption text-sale">
            {problem}
          </p>
        )}
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const message = await applyCoupon(code);
      setError(message);
      if (!message) setCode("");
    });
  }

  return (
    <form onSubmit={submit} noValidate className={cn("flex flex-col gap-1.5", className)}>
      <div className="relative flex flex-col gap-2 tablet:flex-row tablet:gap-0">
        <label htmlFor={inputId} className="sr-only">
          {cartCopy.couponTitle}
        </label>
        <input
          id={inputId}
          name="code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (error) setError(null);
          }}
          placeholder={cartCopy.couponPlaceholder}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(
            "h-12 w-full rounded-full border border-border bg-background px-6 text-lead text-foreground outline-none placeholder:text-muted-foreground focus:border-primary laptop:h-13 tablet:pr-48 laptop:pr-52",
            error && "border-sale focus:border-sale",
          )}
        />
        <button
          type="submit"
          disabled={pending}
          className="press h-12 shrink-0 rounded-full bg-foreground px-8 text-copy font-semibold text-background hover:bg-brand-ink disabled:opacity-60 tablet:absolute tablet:inset-y-0 tablet:right-0 tablet:h-auto tablet:w-44 laptop:w-49 laptop:text-lead"
        >
          {cartCopy.applyCoupon}
        </button>
      </div>
      {/* Nothing sits below the coupon card, so the message can appear without shifting the cart. */}
      <p id={errorId} role="alert" className="px-6 text-caption text-sale empty:hidden">
        {error}
      </p>
    </form>
  );
}
