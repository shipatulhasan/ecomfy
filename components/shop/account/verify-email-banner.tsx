"use client";

import { MailWarningIcon } from "lucide-react";
import { useActionState } from "react";
import { resendVerificationAction } from "@/lib/actions/auth";

/**
 * Shown on every account page until the email is verified. The account works
 * meanwhile; the link (24h) signs the user in and lands on /account?verified=1.
 */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerificationAction, null);
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-copy text-warning-strong tablet:flex-row tablet:items-center tablet:justify-between laptop:px-6"
    >
      <p className="flex items-start gap-2">
        <MailWarningIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
        <span>
          <strong className="font-semibold">Verify your email.</strong>{" "}
          {state?.ok ? state.data.message : state && !state.ok ? state.error : `We sent a link to ${email}.`}
        </span>
      </p>
      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="press tap-target rounded-full border border-warning-strong/40 px-4 text-copy font-medium hover:bg-background/60 disabled:opacity-70"
        >
          {pending ? "Sending…" : "Resend link"}
        </button>
      </form>
    </div>
  );
}
