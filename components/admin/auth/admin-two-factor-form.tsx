"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FormAlert, FormField, SubmitButton, TextInput } from "@/components/shared/form-field";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { adminVerifyTwoFactorAction } from "@/lib/actions/admin-auth";
import { safeAdminCallbackUrl } from "@/lib/callback-url";
import { adminInputClass, adminSubmitClass, AuthSwitch } from "./auth-card";

/** Authenticator code, or (toggle) a single-use backup code. "Trust this device" skips it for 30 days. */
export function AdminTwoFactorForm() {
  return (
    <Suspense fallback={<VerifyView callbackUrl="/admin" />}>
      <FromUrl />
    </Suspense>
  );
}

function FromUrl() {
  const params = useSearchParams();
  return <VerifyView callbackUrl={safeAdminCallbackUrl(params.get("callbackUrl"))} />;
}

function VerifyView({ callbackUrl }: { callbackUrl: string }) {
  const [mode, setMode] = useState<"totp" | "backup">("totp");
  const { pending, onSubmit, errors, formError } = useKeptForm(adminVerifyTwoFactorAction);
  return (
    <>
      <form key={mode} onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <p className="text-copy text-muted-foreground">
          {mode === "totp" ? "Enter the 6-digit code from your authenticator app." : "Enter one of the backup codes you saved. Each works once."}
        </p>
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <input type="hidden" name="mode" value={mode} />
        <FormField label={mode === "totp" ? "Authentication code" : "Backup code"} htmlFor="tf-code" hideLabel error={errors?.code?.[0]} errorId="tf-code-error">
          <TextInput
            id="tf-code"
            name="code"
            autoComplete="one-time-code"
            inputMode={mode === "totp" ? "numeric" : "text"}
            autoCapitalize="none"
            spellCheck={false}
            placeholder={mode === "totp" ? "123 456" : "Backup code"}
            autoFocus
            required
            className={adminInputClass}
            aria-invalid={!!errors?.code}
            aria-describedby={errors?.code ? "tf-code-error" : undefined}
          />
        </FormField>
        <Label className="tap-target mt-1 flex cursor-pointer items-center gap-1.5 text-copy font-normal text-muted-foreground">
          <Checkbox name="trustDevice" className="size-5 rounded-sm" />
          Trust this device for 30 days
        </Label>
        <SubmitButton pending={pending} pendingLabel="Verifying…" className={adminSubmitClass}>
          Verify
        </SubmitButton>
        <button
          type="button"
          onClick={() => setMode(mode === "totp" ? "backup" : "totp")}
          className="tap-target self-center text-copy text-primary hover:underline"
        >
          {mode === "totp" ? "Use a backup code instead" : "Use the authenticator app"}
        </button>
      </form>
      <AuthSwitch prompt="Not you?">
        <Link href="/admin/login" className="hover:text-primary">
          Back to login
        </Link>
      </AuthSwitch>
    </>
  );
}
