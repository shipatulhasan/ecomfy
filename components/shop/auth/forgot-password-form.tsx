"use client";

import Link from "next/link";
import { useState } from "react";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { FormAlert, FormField, SubmitButton, TextInput } from "@/components/shared/form-field";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { requestPasswordResetAction } from "@/lib/actions/auth";
import { AuthSwitch } from "./auth-screen";

const FORM_ID = "forgot-password-form";

/** Forgot password (no PNG; styled like Sign_In.png). Same answer for every email. */
export function ForgotPasswordForm() {
  const { state, pending, onSubmit, errors, formError } = useKeptForm(requestPasswordResetAction);
  const [email, setEmail] = useState("");
  const sent = state?.ok ? state.data.message : null;

  return (
    <>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <p className="text-copy text-text-body">
          Enter the email you signed up with and we&apos;ll send you a link to choose a new password.
        </p>
        {sent && <FormAlert tone="success">{sent}</FormAlert>}
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        <FormField label="Email" htmlFor="forgot-email" hideLabel error={errors?.email?.[0]} errorId="forgot-email-error">
          <TextInput
            id="forgot-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors?.email}
            aria-describedby={errors?.email ? "forgot-email-error" : undefined}
          />
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Sending…" className="mt-2 hidden w-full laptop:inline-flex">
          {sent ? "Send again" : "Send reset link"}
        </SubmitButton>
      </form>
      <AuthSwitch prompt="Remembered it?">
        <Link href="/sign-in" className="hover:text-primary">
          Login
        </Link>
      </AuthSwitch>
      <StickyActionBar>
        <SubmitButton form={FORM_ID} pending={pending} pendingLabel="Sending…" className="w-full">
          {sent ? "Send again" : "Send reset link"}
        </SubmitButton>
      </StickyActionBar>
    </>
  );
}
