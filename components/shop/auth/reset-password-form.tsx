"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { FormAlert, FormField, SubmitButton } from "@/components/shared/form-field";
import { StickyActionBar } from "@/components/shared/sticky-action-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { resetPasswordAction } from "@/lib/actions/auth";
import { AuthSwitch } from "./auth-screen";
import { PasswordInput } from "./password-input";
import { PasswordStrength } from "./password-strength";

const FORM_ID = "reset-password-form";

/**
 * Reset password (no PNG; styled like Sign_In.png). The emailed link lands on
 * /reset-password?token=… (Better Auth adds `?error=INVALID_TOKEN` when the
 * token is expired or used). Success → /sign-in?reset=1.
 */
export function ResetPasswordForm() {
  return (
    <Suspense fallback={<Skeleton className="h-52 w-full" />}>
      <ResetPasswordFromUrl />
    </Suspense>
  );
}

function ResetPasswordFromUrl() {
  const params = useSearchParams();
  const token = params.get("token");
  if (!token || params.get("error")) return <ExpiredLink />;
  return <ResetPasswordView token={token} />;
}

function ExpiredLink() {
  return (
    <div className="flex flex-col gap-4">
      <FormAlert tone="error">This reset link is invalid or has expired. Links work once, for 1 hour.</FormAlert>
      <Link
        href="/forgot-password"
        className="press inline-flex h-12 items-center justify-center rounded-full bg-primary px-8 text-copy font-semibold text-primary-foreground hover:bg-brand-dark laptop:h-11.25"
      >
        Request a new link
      </Link>
    </div>
  );
}

function ResetPasswordView({ token }: { token: string }) {
  const { pending, onSubmit, errors, formError } = useKeptForm(resetPasswordAction);
  const [password, setPassword] = useState("");

  return (
    <>
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <p className="text-copy text-text-body">Choose a new password. You&apos;ll be signed out on every device.</p>
        {formError && (
          <FormAlert tone="error">
            {formError}{" "}
            <Link href="/forgot-password" className="font-medium underline">
              Request a new link
            </Link>
          </FormAlert>
        )}
        <input type="hidden" name="token" value={token} />
        <FormField
          label="New password"
          htmlFor="reset-password"
          hideLabel
          error={errors?.password?.[0] ?? errors?.token?.[0]}
          errorId="reset-password-error"
        >
          <PasswordInput
            id="reset-password"
            name="password"
            autoComplete="new-password"
            placeholder="New Password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors?.password}
            aria-describedby={errors?.password ? "reset-password-error" : "reset-password-strength"}
          />
          {password && <PasswordStrength id="reset-password-strength" password={password} />}
        </FormField>
        <FormField
          label="Confirm password"
          htmlFor="reset-confirm"
          hideLabel
          error={errors?.confirmPassword?.[0]}
          errorId="reset-confirm-error"
        >
          <PasswordInput
            id="reset-confirm"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Confirm Password"
            required
            aria-invalid={!!errors?.confirmPassword}
            aria-describedby={errors?.confirmPassword ? "reset-confirm-error" : undefined}
          />
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Saving…" className="mt-2 hidden w-full laptop:inline-flex">
          Reset Password
        </SubmitButton>
      </form>
      <AuthSwitch prompt="Remembered it?">
        <Link href="/sign-in" className="hover:text-primary">
          Login
        </Link>
      </AuthSwitch>
      <StickyActionBar>
        <SubmitButton form={FORM_ID} pending={pending} pendingLabel="Saving…" className="w-full">
          Reset Password
        </SubmitButton>
      </StickyActionBar>
    </>
  );
}
