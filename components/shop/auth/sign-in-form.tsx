"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { FormAlert, FormField, SubmitButton, TextInput } from "@/components/shared/form-field";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { signInAction } from "@/lib/actions/auth";
import { AuthSwitch } from "./auth-screen";
import { GoogleButton } from "./google-button";
import { PasswordInput } from "./password-input";
import { useAuthParams, withCallback } from "./use-auth-params";

const FORM_ID = "sign-in-form";

/** Sign_In.png: Email, Password (eye), Remember me · Forget Password, Login, Register. */
export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  // The query (?callbackUrl, ?reset=1) is URL data: the prerendered shell gets the
  // same form with the defaults, and the URL-aware one replaces it on the client.
  return (
    <Suspense fallback={<SignInFormView googleEnabled={googleEnabled} callbackUrl="/account" notice={null} />}>
      <SignInFormFromUrl googleEnabled={googleEnabled} />
    </Suspense>
  );
}

function SignInFormFromUrl({ googleEnabled }: { googleEnabled: boolean }) {
  const { callbackUrl, params } = useAuthParams();
  const notice = params.get("reset")
    ? { tone: "success" as const, text: "Your password has been reset. Sign in with the new one." }
    : params.get("error")
      ? { tone: "error" as const, text: "Google sign-in didn't complete. Please try again or use your email." }
      : null;
  return <SignInFormView googleEnabled={googleEnabled} callbackUrl={callbackUrl} notice={notice} />;
}

function SignInFormView({
  googleEnabled,
  callbackUrl,
  notice,
}: {
  googleEnabled: boolean;
  callbackUrl: string;
  notice: { tone: "success" | "error"; text: string } | null;
}) {
  const { state, pending, onSubmit, errors, formError } = useKeptForm(signInAction);
  const [email, setEmail] = useState("");

  return (
    <>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {notice && !state && <FormAlert tone={notice.tone}>{notice.text}</FormAlert>}
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <FormField label="Email" htmlFor="signin-email" hideLabel error={errors?.email?.[0]} errorId="signin-email-error">
          <TextInput
            id="signin-email"
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
            aria-describedby={errors?.email ? "signin-email-error" : undefined}
          />
        </FormField>
        <FormField
          label="Password"
          htmlFor="signin-password"
          hideLabel
          error={errors?.password?.[0]}
          errorId="signin-password-error"
        >
          <PasswordInput
            id="signin-password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            required
            aria-invalid={!!errors?.password}
            aria-describedby={errors?.password ? "signin-password-error" : undefined}
          />
        </FormField>
        <div className="mt-1 flex items-center justify-between gap-4">
          <Label className="tap-target flex cursor-pointer items-center gap-1.5 text-copy font-normal text-text-body">
            <Checkbox name="rememberMe" className="size-5 rounded-sm" />
            Remember me
          </Label>
          <Link href="/forgot-password" className="tap-target flex items-center text-copy text-text-body hover:text-primary">
            Forget Password
          </Link>
        </div>
        <SubmitButton pending={pending} pendingLabel="Signing in…" className="mt-2 hidden w-full laptop:mt-2 laptop:inline-flex">
          Login
        </SubmitButton>
      </form>
      {googleEnabled && <GoogleButton callbackUrl={callbackUrl} className="mt-4" />}
      <AuthSwitch prompt="Don’t have account?">
        <Link href={withCallback("/sign-up", callbackUrl)} className="hover:text-primary">
          Register
        </Link>
      </AuthSwitch>
      <StickyActionBar>
        <SubmitButton form={FORM_ID} pending={pending} pendingLabel="Signing in…" className="w-full">
          Login
        </SubmitButton>
      </StickyActionBar>
    </>
  );
}
