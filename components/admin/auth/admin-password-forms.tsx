"use client";

import Link from "next/link";
import { FormAlert, FormField, SubmitButton, TextInput } from "@/components/shared/form-field";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { PasswordInput } from "@/components/shop/auth/password-input";
import { adminRequestPasswordResetAction, adminResetPasswordAction } from "@/lib/actions/admin-auth";
import { adminInputClass, adminSubmitClass, AuthSwitch } from "./auth-card";

/** Forgot password (no PNG): the Login card with one field. */
export function AdminForgotPasswordForm() {
  const { state, pending, onSubmit, errors, formError } = useKeptForm(adminRequestPasswordResetAction);
  const sent = state?.ok ? state.data.message : null;
  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        {sent && <FormAlert tone="success">{sent}</FormAlert>}
        <FormField label="Email" htmlFor="forgot-email" hideLabel error={errors?.email?.[0]} errorId="forgot-email-error">
          <TextInput
            id="forgot-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="Email"
            required
            className={adminInputClass}
            aria-invalid={!!errors?.email}
            aria-describedby={errors?.email ? "forgot-email-error" : undefined}
          />
        </FormField>
        <SubmitButton pending={pending} pendingLabel="Sending…" className={adminSubmitClass}>
          Send reset link
        </SubmitButton>
      </form>
      <AuthSwitch prompt="Remembered it?">
        <Link href="/admin/login" className="font-bold hover:text-primary">
          Login
        </Link>
      </AuthSwitch>
    </>
  );
}

/** Reset password (no PNG): ?token= from the emailed link. */
export function AdminResetPasswordForm({ token }: { token: string }) {
  const { pending, onSubmit, errors, formError } = useKeptForm(adminResetPasswordAction);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {formError && <FormAlert tone="error">{formError}</FormAlert>}
      {errors?.token?.[0] && <FormAlert tone="error">{errors.token[0]}</FormAlert>}
      <input type="hidden" name="token" value={token} />
      <FormField label="New password" htmlFor="reset-password" hideLabel error={errors?.password?.[0]} errorId="reset-password-error">
        <PasswordInput
          id="reset-password"
          name="password"
          autoComplete="new-password"
          placeholder="New password"
          required
          minLength={8}
          className={adminInputClass}
          aria-invalid={!!errors?.password}
          aria-describedby={errors?.password ? "reset-password-error" : undefined}
        />
      </FormField>
      <FormField
        label="Confirm Password"
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
          className={adminInputClass}
          aria-invalid={!!errors?.confirmPassword}
          aria-describedby={errors?.confirmPassword ? "reset-confirm-error" : undefined}
        />
      </FormField>
      <SubmitButton pending={pending} pendingLabel="Saving…" className={adminSubmitClass}>
        Reset password
      </SubmitButton>
    </form>
  );
}
