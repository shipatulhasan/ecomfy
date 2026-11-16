"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FormAlert, FormField, SubmitButton, TextInput } from "@/components/shared/form-field";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { PasswordInput } from "@/components/shop/auth/password-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { adminSignInAction } from "@/lib/actions/admin-auth";
import { safeAdminCallbackUrl } from "@/lib/callback-url";
import { adminInputClass, adminSubmitClass, AuthSwitch } from "./auth-card";

type Notice = { tone: "success" | "error"; text: string } | null;

/** Login.png: Email, Password (eye), Remember me · Forget Password, Login, Register. */
export function AdminLoginForm() {
  return (
    <Suspense fallback={<LoginFormView callbackUrl="/admin" notice={null} />}>
      <LoginFormFromUrl />
    </Suspense>
  );
}

function LoginFormFromUrl() {
  const params = useSearchParams();
  const notice: Notice = params.get("registered")
    ? { tone: "success", text: "Your admin account is ready. Sign in to continue." }
    : params.get("reset")
      ? { tone: "success", text: "Your password has been reset. Sign in with the new one." }
      : null;
  return <LoginFormView callbackUrl={safeAdminCallbackUrl(params.get("callbackUrl"))} notice={notice} />;
}

function LoginFormView({ callbackUrl, notice }: { callbackUrl: string; notice: Notice }) {
  const { state, pending, onSubmit, errors, formError } = useKeptForm(adminSignInAction);
  return (
    <>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        {notice && !state && <FormAlert tone={notice.tone}>{notice.text}</FormAlert>}
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <FormField label="Email" htmlFor="admin-email" hideLabel error={errors?.email?.[0]} errorId="admin-email-error">
          <TextInput
            id="admin-email"
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
            aria-describedby={errors?.email ? "admin-email-error" : undefined}
          />
        </FormField>
        <FormField label="Password" htmlFor="admin-password" hideLabel error={errors?.password?.[0]} errorId="admin-password-error">
          <PasswordInput
            id="admin-password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            required
            className={adminInputClass}
            aria-invalid={!!errors?.password}
            aria-describedby={errors?.password ? "admin-password-error" : undefined}
          />
        </FormField>
        <div className="mt-1 flex items-center justify-between gap-4">
          <Label className="tap-target flex cursor-pointer items-center gap-1.5 text-copy font-normal text-muted-foreground">
            <Checkbox name="rememberMe" className="size-5 rounded-sm" />
            Remember me
          </Label>
          <Link href="/admin/forgot-password" className="tap-target flex items-center text-copy text-foreground hover:text-primary">
            Forget Password
          </Link>
        </div>
        <SubmitButton pending={pending} pendingLabel="Signing in…" className={adminSubmitClass}>
          Login
        </SubmitButton>
      </form>
      <AuthSwitch prompt="Don’t have account?">
        <Link href="/admin/register" className="hover:text-primary">
          Register
        </Link>
      </AuthSwitch>
    </>
  );
}
