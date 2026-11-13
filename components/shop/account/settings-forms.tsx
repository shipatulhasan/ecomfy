"use client";

import { ChevronDownIcon } from "lucide-react";
import Image from "next/image";
import { useActionState, useEffect, useRef, useState } from "react";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { FormAlert, FormField, SubmitButton, TextInput, inputClass } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shop/auth/password-input";
import { PasswordStrength } from "@/components/shop/auth/password-strength";
import {
  changePasswordAction,
  saveBillingAddressAction,
  updateProfileAction,
  uploadAvatarAction,
} from "@/lib/actions/account";
import type { ActionResult } from "@/lib/actions/result";
import { DISTRICTS } from "@/lib/config/districts";
import type { AccountAddress } from "@/lib/queries/account";
import { cn } from "@/lib/utils";
import { UserAvatarFallback } from "./user-avatar-fallback";

/**
 * Settings.png forms. Each card is its own form + server action with inline field
 * errors and a pending button. Profile and address forms keep what was typed
 * (submitted without the automatic form reset); the password form clears on success.
 */
type State = ActionResult<{ message: string }> | null;

function Result({ state }: { state: State }) {
  if (!state) return null;
  if (state.ok) return <FormAlert tone="success">{state.data.message}</FormAlert>;
  if (!state.fieldErrors) return <FormAlert tone="error">{state.error}</FormAlert>;
  return null;
}

const cardTitle = "border-b border-border px-4 py-4 text-h4 font-medium text-foreground tablet:px-6";
const cardBody = "p-4 tablet:px-6 tablet:pt-6 tablet:pb-6";
export const settingsCard = "rounded-lg border border-border bg-card";

// ───────────────────────── Account Settings ─────────────────────────

export function AccountSettingsCard({
  firstName,
  lastName,
  email,
  phone,
  name,
  image,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  name: string;
  image: string | null;
}) {
  const { state, pending, onSubmit, err } = useKeptForm(updateProfileAction);
  return (
    <section aria-labelledby="account-settings-title" className={settingsCard}>
      <h2 id="account-settings-title" className={cardTitle}>
        Account Settings
      </h2>
      <div className={cn(cardBody, "flex flex-col gap-6 laptop:flex-row-reverse laptop:items-start laptop:justify-between laptop:gap-10")}>
        <AvatarPicker name={name} image={image} />
        <form onSubmit={onSubmit} noValidate className="flex w-full flex-col gap-4 laptop:max-w-128">
          <FormField label="First name" htmlFor="profile-first" error={err("firstName")} errorId="profile-first-error">
            <TextInput id="profile-first" name="firstName" autoComplete="given-name" defaultValue={firstName} required aria-invalid={!!err("firstName")} aria-describedby={err("firstName") ? "profile-first-error" : undefined} />
          </FormField>
          <FormField label="Last Name" htmlFor="profile-last" error={err("lastName")} errorId="profile-last-error">
            <TextInput id="profile-last" name="lastName" autoComplete="family-name" defaultValue={lastName} aria-invalid={!!err("lastName")} />
          </FormField>
          <FormField label="Email" htmlFor="profile-email">
            <TextInput id="profile-email" type="email" value={email} readOnly aria-describedby="profile-email-note" className="bg-muted text-text-body" />
            <span id="profile-email-note" className="text-caption text-text-subtle">
              Your sign-in email can&apos;t be changed here.
            </span>
          </FormField>
          <FormField label="Phone Number" htmlFor="profile-phone" error={err("phone")} errorId="profile-phone-error">
            <TextInput id="profile-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" defaultValue={phone} aria-invalid={!!err("phone")} aria-describedby={err("phone") ? "profile-phone-error" : undefined} />
          </FormField>
          <Result state={state} />
          <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full tablet:w-fit">
            Save Changes
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}

/** 224 design-px photo + "Choose Image": uploads as soon as a file is picked. */
function AvatarPicker({ name, image }: { name: string; image: string | null }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Once the upload settles (saved or rejected), show the stored photo again.
  const [state, action, pending] = useActionState(async (prev: State, fd: FormData) => {
    const result = await uploadAvatarAction(prev, fd);
    setPreview(null);
    return result;
  }, null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = preview ?? image;
  return (
    <form ref={formRef} action={action} className="flex flex-col items-center gap-4 laptop:w-56 laptop:shrink-0 laptop:pt-2">
      <span className="relative size-32 overflow-hidden rounded-full bg-secondary laptop:size-56">
        {shown ? (
          <Image src={shown} alt="Your profile photo" fill sizes="(width >= 64rem) 14rem, 8rem" className={cn("object-cover", pending && "animate-pulse")} unoptimized={!!preview} />
        ) : (
          <UserAvatarFallback name={name} />
        )}
      </span>
      <label
        className={cn(
          "press inline-flex h-11.25 cursor-pointer items-center rounded-full border-2 border-primary px-8 text-copy font-semibold text-primary transition-colors hover:bg-secondary has-focus-visible:ring-3 has-focus-visible:ring-primary/30",
          pending && "pointer-events-none animate-pulse",
        )}
      >
        {pending ? "Uploading…" : "Choose Image"}
        <input
          type="file"
          name="avatar"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setPreview(URL.createObjectURL(file));
            formRef.current?.requestSubmit();
          }}
        />
      </label>
      {state && !state.ok && (
        <p role="alert" className="text-center text-caption text-destructive">
          {state.fieldErrors?.file?.[0] ?? state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-caption text-brand-dark">
          {state.data.message}
        </p>
      )}
    </form>
  );
}

// ───────────────────────── Billing Address ─────────────────────────

export function BillingAddressForm({ address, fallbackEmail }: { address: AccountAddress | null; fallbackEmail: string }) {
  const { state, pending, onSubmit, err } = useKeptForm(saveBillingAddressAction);
  const a = address;
  const field = (key: keyof Omit<AccountAddress, "id">, label: string, props: React.ComponentProps<"input"> = {}, optional = false) => (
    <FormField label={label} htmlFor={`bill-${key}`} error={err(key)} errorId={`bill-${key}-error`} optional={optional}>
      <TextInput
        id={`bill-${key}`}
        name={key}
        defaultValue={a?.[key] ?? (key === "email" ? fallbackEmail : "")}
        aria-invalid={!!err(key)}
        aria-describedby={err(key) ? `bill-${key}-error` : undefined}
        {...props}
      />
    </FormField>
  );
  return (
    <section id="billing" aria-labelledby="billing-form-title" className={cn(settingsCard, "scroll-mt-[calc(var(--app-header-h)+1rem)]")}>
      <h2 id="billing-form-title" className={cardTitle}>
        Billing Address
      </h2>
      <form onSubmit={onSubmit} noValidate className={cn(cardBody, "grid gap-4 tablet:grid-cols-6")}>
        <div className="tablet:col-span-2">{field("firstName", "First name", { autoComplete: "given-name", required: true })}</div>
        <div className="tablet:col-span-2">{field("lastName", "Last name", { autoComplete: "family-name", required: true })}</div>
        <div className="tablet:col-span-2">{field("companyName", "Company Name", { autoComplete: "organization" }, true)}</div>
        <div className="tablet:col-span-6">{field("street", "Street Address", { autoComplete: "address-line1", required: true })}</div>
        <div className="tablet:col-span-2">
          <FormField label="District" htmlFor="bill-district" error={err("district")} errorId="bill-district-error">
            <div className="relative">
              <select
                id="bill-district"
                name="district"
                defaultValue={a?.district && (DISTRICTS as readonly string[]).includes(a.district) ? a.district : ""}
                autoComplete="address-level1"
                aria-invalid={!!err("district")}
                aria-describedby={err("district") ? "bill-district-error" : undefined}
                className={cn(inputClass, "appearance-none pr-10")}
              >
                <option value="" disabled>
                  Choose a district
                </option>
                {DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-foreground" />
            </div>
          </FormField>
        </div>
        <div className="tablet:col-span-2">{field("city", "Area / Thana", { autoComplete: "address-level2", required: true })}</div>
        <div className="tablet:col-span-2">{field("zip", "Zip Code", { autoComplete: "postal-code", inputMode: "numeric", maxLength: 4, required: true })}</div>
        <div className="tablet:col-span-3">{field("email", "Email", { type: "email", inputMode: "email", autoComplete: "email", required: true })}</div>
        <div className="tablet:col-span-3">{field("phone", "Phone", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "01XXXXXXXXX", required: true })}</div>
        <div className="flex flex-col gap-4 tablet:col-span-6">
          <Result state={state} />
          <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full tablet:w-fit">
            Save Changes
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}

// ───────────────────────── Change Password ─────────────────────────

export function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [state, action, pending] = useActionState(async (prev: State, fd: FormData) => {
    const result = await changePasswordAction(prev, fd);
    if (result?.ok) setPw("");
    return result;
  }, null);
  const errors = state && !state.ok ? state.fieldErrors : undefined;
  const err = (k: string) => errors?.[k]?.[0];
  return (
    <section aria-labelledby="password-title" className={settingsCard}>
      <h2 id="password-title" className={cardTitle}>
        Change Password
      </h2>
      <form action={action} noValidate className={cn(cardBody, "grid gap-4 tablet:grid-cols-2")}>
        {/* Lets password managers attach the new password to the right account. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <FormField label="Current Password" htmlFor="pw-current" error={err("currentPassword")} errorId="pw-current-error" className="tablet:col-span-2">
          <PasswordInput id="pw-current" name="currentPassword" autoComplete="current-password" placeholder="Password" required aria-invalid={!!err("currentPassword")} aria-describedby={err("currentPassword") ? "pw-current-error" : undefined} />
        </FormField>
        <FormField label="New Password" htmlFor="pw-new" error={err("newPassword")} errorId="pw-new-error">
          <PasswordInput id="pw-new" name="newPassword" autoComplete="new-password" placeholder="Password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} aria-invalid={!!err("newPassword")} aria-describedby={err("newPassword") ? "pw-new-error" : undefined} />
          {pw && <PasswordStrength password={pw} />}
        </FormField>
        <FormField label="Confirm Password" htmlFor="pw-confirm" error={err("confirmPassword")} errorId="pw-confirm-error">
          <PasswordInput id="pw-confirm" name="confirmPassword" autoComplete="new-password" placeholder="Password" required aria-invalid={!!err("confirmPassword")} aria-describedby={err("confirmPassword") ? "pw-confirm-error" : undefined} />
        </FormField>
        <div className="flex flex-col gap-4 tablet:col-span-2">
          <Result state={state} />
          <SubmitButton pending={pending} pendingLabel="Changing…" className="w-full tablet:w-fit">
            Change Password
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
