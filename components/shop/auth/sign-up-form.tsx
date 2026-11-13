"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { FormAlert, FormField, SubmitButton, TextInput } from "@/components/shared/form-field";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { signUpAction } from "@/lib/actions/auth";
import { AuthSwitch } from "./auth-screen";
import { GoogleButton } from "./google-button";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";
import { useAuthParams, withCallback } from "./use-auth-params";

const FORM_ID = "sign-up-form";

/**
 * Create_Account.png: Email, Password, Confirm Password (eyes), "Accept all terms &
 * Conditions", Create Account, "Already have account Login". No name field: the
 * name comes from the email and is edited in Settings.
 */
export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  return (
    <Suspense fallback={<SignUpFormView googleEnabled={googleEnabled} callbackUrl="/account" />}>
      <SignUpFormFromUrl googleEnabled={googleEnabled} />
    </Suspense>
  );
}

function SignUpFormFromUrl({ googleEnabled }: { googleEnabled: boolean }) {
  const { callbackUrl } = useAuthParams();
  return <SignUpFormView googleEnabled={googleEnabled} callbackUrl={callbackUrl} />;
}

function SignUpFormView({ googleEnabled, callbackUrl }: { googleEnabled: boolean; callbackUrl: string }) {
  const { pending, onSubmit, errors, formError } = useKeptForm(signUpAction);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <FormField label="Email" htmlFor="signup-email" hideLabel error={errors?.email?.[0]} errorId="signup-email-error">
          <TextInput
            id="signup-email"
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
            aria-describedby={errors?.email ? "signup-email-error" : undefined}
          />
        </FormField>
        <FormField
          label="Password"
          htmlFor="signup-password"
          hideLabel
          error={errors?.password?.[0]}
          errorId="signup-password-error"
        >
          <PasswordInput
            id="signup-password"
            name="password"
            autoComplete="new-password"
            placeholder="Password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors?.password}
            aria-describedby={errors?.password ? "signup-password-error" : "signup-password-strength"}
          />
          {password && <PasswordStrength id="signup-password-strength" password={password} />}
        </FormField>
        <FormField
          label="Confirm Password"
          htmlFor="signup-confirm"
          hideLabel
          error={errors?.confirmPassword?.[0]}
          errorId="signup-confirm-error"
        >
          <PasswordInput
            id="signup-confirm"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Confirm Password"
            required
            aria-invalid={!!errors?.confirmPassword}
            aria-describedby={errors?.confirmPassword ? "signup-confirm-error" : undefined}
          />
        </FormField>
        <div className="mt-1 flex flex-col gap-1">
          <Label className="tap-target flex w-fit cursor-pointer items-center gap-1.5 text-copy font-normal text-text-body">
            <Checkbox
              name="acceptTerms"
              className="size-5 rounded-sm"
              aria-invalid={!!errors?.acceptTerms}
              aria-describedby={errors?.acceptTerms ? "signup-terms-error" : undefined}
            />
            Accept all terms &amp; Conditions
          </Label>
          {errors?.acceptTerms && (
            <p id="signup-terms-error" className="text-caption text-destructive">
              {errors.acceptTerms[0]}
            </p>
          )}
        </div>
        <SubmitButton pending={pending} pendingLabel="Creating account…" className="mt-2 hidden w-full laptop:inline-flex">
          Create Account
        </SubmitButton>
      </form>
      {googleEnabled && <GoogleButton callbackUrl={callbackUrl} className="mt-4" />}
      <AuthSwitch prompt="Already have account">
        <Link href={withCallback("/sign-in", callbackUrl)} className="hover:text-primary">
          Login
        </Link>
      </AuthSwitch>
      <StickyActionBar>
        <SubmitButton form={FORM_ID} pending={pending} pendingLabel="Creating account…" className="w-full">
          Create Account
        </SubmitButton>
      </StickyActionBar>
    </>
  );
}
