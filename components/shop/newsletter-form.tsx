"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { subscribeNewsletter } from "@/lib/actions/newsletter";
import { cn } from "@/lib/utils";

/** Pill email field + "Subscribe" (server action + zod; works before hydration too). */
export function NewsletterForm({
  placeholder,
  cta,
  className,
}: {
  placeholder: string;
  cta: string;
  className?: string;
}) {
  const [state, action, pending] = useActionState(subscribeNewsletter, null);
  const formRef = useRef<HTMLFormElement>(null);
  const fieldError = state && !state.ok ? (state.fieldErrors?.email?.[0] ?? state.error) : null;

  useEffect(() => {
    if (state?.ok) {
      toast.success("Thanks for subscribing!");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} noValidate className={cn("w-full", className)}>
      <div
        className={cn(
          "flex h-12.5 w-full items-center rounded-full border bg-background pl-6 focus-within:border-primary laptop:h-13",
          fieldError ? "border-destructive" : "border-border",
        )}
      >
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder={placeholder}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? "newsletter-error" : undefined}
          className="min-w-0 flex-1 bg-transparent text-lead text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={pending}
          className="-mr-px h-full shrink-0 rounded-full bg-primary px-6 text-lead font-semibold text-primary-foreground transition-colors hover:bg-brand-dark disabled:opacity-70 tablet:px-10"
        >
          {pending ? "Subscribing…" : cta}
        </button>
      </div>
      <p id="newsletter-error" role="alert" className="mt-1.5 min-h-5 pl-6 text-caption text-destructive">
        {fieldError}
      </p>
    </form>
  );
}
