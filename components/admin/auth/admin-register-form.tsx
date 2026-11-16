"use client";

import Link from "next/link";
import { FormAlert, FormField, SubmitButton, TextInput } from "@/components/shared/form-field";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { PasswordInput } from "@/components/shop/auth/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { acceptInviteAction } from "@/lib/actions/admin-auth";
import { adminInputClass, adminSubmitClass, AuthSwitch } from "./auth-card";

/**
 * Register.png, opened from an invite link: Email (fixed by the invite),
 * Password, Confirm Password, Accept all terms & Conditions, Create Account.
 */
export function AdminRegisterForm({ token, email }: { token: string; email: string }) {
  const { pending, onSubmit, errors, formError } = useKeptForm(acceptInviteAction);
  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        <input type="hidden" name="token" value={token} />
        <FormField label="Email" htmlFor="invite-email" hideLabel>
          <TextInput
            id="invite-email"
            type="email"
            autoComplete="username"
            value={email}
            readOnly
            aria-readonly
            title="This email comes from your invitation"
            className={`${adminInputClass} text-text-body`}
          />
        </FormField>
        <FormField label="Password" htmlFor="invite-password" hideLabel error={errors?.password?.[0]} errorId="invite-password-error">
          <PasswordInput
            id="invite-password"
            name="password"
            autoComplete="new-password"
            placeholder="Password"
            required
            minLength={8}
            className={adminInputClass}
            aria-invalid={!!errors?.password}
            aria-describedby={errors?.password ? "invite-password-error" : undefined}
          />
        </FormField>
        <FormField
          label="Confirm Password"
          htmlFor="invite-confirm"
          hideLabel
          error={errors?.confirmPassword?.[0]}
          errorId="invite-confirm-error"
        >
          <PasswordInput
            id="invite-confirm"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Confirm Password"
            required
            className={adminInputClass}
            aria-invalid={!!errors?.confirmPassword}
            aria-describedby={errors?.confirmPassword ? "invite-confirm-error" : undefined}
          />
        </FormField>
        <div className="mt-1 flex flex-col gap-1">
          <Label className="tap-target flex w-fit cursor-pointer items-center gap-1.5 text-copy font-normal text-text-body">
            <Checkbox name="acceptTerms" className="size-5 rounded-sm" aria-invalid={!!errors?.acceptTerms} />
            Accept all terms &amp; Conditions
          </Label>
          {errors?.acceptTerms?.[0] && <p className="text-caption text-destructive">{errors.acceptTerms[0]}</p>}
        </div>
        <SubmitButton pending={pending} pendingLabel="Creating account…" className={adminSubmitClass}>
          Create Account
        </SubmitButton>
      </form>
      <AuthSwitch prompt="Already have account">
        <Link href="/admin/login" className="font-bold hover:text-primary">
          Login
        </Link>
      </AuthSwitch>
    </>
  );
}
