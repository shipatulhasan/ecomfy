"use client";

import { CalendarIcon, CircleHelpIcon, PencilLineIcon, Share2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, fieldInput } from "@/components/admin/products/form/fields";
import { CopyButton } from "@/components/admin/orders/detail/forms";
import { FormAlert } from "@/components/shared/form-field";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { useUnsavedChangesGuard } from "@/components/shared/use-unsaved-guard";
import { PasswordInput } from "@/components/shop/auth/password-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { changePasswordAction, getAvatarUploadUrl, requestEmailChangeAction, setAvatarAction, updateProfileAction } from "@/lib/actions/admin-account";
import { UPLOAD_ACCEPT } from "@/lib/media/upload-rules";
import { cn } from "@/lib/utils";
import { outlineButton, primaryButton, SettingsCard } from "./section";
import { useImageUpload } from "./use-image-upload";

export type ProfileData = {
  firstName: string;
  lastName: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phone: string;
  dateOfBirth: string;
  location: string;
  bio: string;
  roleName: string;
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const pwInput = cn(fieldInput, "h-12 bg-muted pr-13 text-lead");

/**
 * Account & Settings.png: Profile card + Change Password card (376 column) |
 * Profile Update card. Deliberate differences: no Credit Card field and no
 * "Linked with Social media" block (dropped on request); the Profile Update
 * "Password" field is read-only with a link to the Change Password card (one
 * place changes the password); the phone is BD (+880), not the US flag.
 */
export function ProfileTab({ profile, maxMb }: { profile: ProfileData; maxMb: number }) {
  const [editing, setEditing] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const name = [profile.firstName, profile.lastName].filter(Boolean).join(" ");

  const startEditing = () => {
    setEditing(true);
    requestAnimationFrame(() => firstRef.current?.focus());
  };

  return (
    <div className="grid gap-5 laptop:grid-cols-[23.5rem_minmax(0,1fr)] laptop:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <SettingsCard
          title="Profile"
          aria-label="Profile"
          action={
            <div className="flex items-center gap-1">
              <button type="button" onClick={startEditing} aria-label="Edit profile" className="tap-target grid size-8 place-items-center rounded-md text-text-body hover:bg-muted hover:text-foreground">
                <PencilLineIcon aria-hidden className="size-6 stroke-[1.5]" />
              </button>
              <ShareButton name={name} email={profile.email} />
            </div>
          }
        >
          <div className="flex flex-col items-center gap-1 pb-2 text-center">
            <Avatar className="mb-2 size-32.5">
              {profile.image && <AvatarImage src={profile.image} alt="" />}
              <AvatarFallback className="bg-secondary text-h1 font-bold text-primary">{initials(name)}</AvatarFallback>
            </Avatar>
            <p className="text-h2 font-bold text-foreground">{name}</p>
            <p className="text-caption font-bold text-primary">{profile.roleName}</p>
            <div className="flex max-w-full items-center gap-1">
              <span className="truncate text-lead text-text-body">{profile.email}</span>
              <CopyButton value={profile.email} label="Copy email" className="text-primary" />
            </div>
          </div>
        </SettingsCard>
        <ChangePasswordCard inputRef={passwordRef} />
      </div>

      <ProfileUpdateCard
        profile={profile}
        maxMb={maxMb}
        editing={editing}
        setEditing={setEditing}
        firstRef={firstRef}
        onChangePassword={() => {
          passwordRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          passwordRef.current?.focus({ preventScroll: true });
        }}
      />
    </div>
  );
}

function ShareButton({ name, email }: { name: string; email: string }) {
  const share = async () => {
    const text = `${name} <${email}>`;
    try {
      if (navigator.share) await navigator.share({ title: name, text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Contact copied.");
      }
    } catch {
      // Share sheet dismissed.
    }
  };
  return (
    <button type="button" onClick={share} aria-label="Share contact" className="tap-target grid size-8 place-items-center rounded-md text-text-body hover:bg-muted hover:text-foreground">
      <Share2Icon aria-hidden className="size-6 stroke-[1.5]" />
    </button>
  );
}

function ChangePasswordCard({ inputRef }: { inputRef: React.Ref<HTMLInputElement> }) {
  const { state, pending, onSubmit, err, formError } = useKeptForm(changePasswordAction);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(state.data.message ?? "Password changed.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <SettingsCard
      title="Change Password"
      action={
        <Link href="/admin/forgot-password" className="tap-target inline-flex items-center gap-1 text-lead text-info underline underline-offset-4 hover:text-info-strong">
          Need help <CircleHelpIcon aria-hidden className="size-5 stroke-[1.5]" />
        </Link>
      }
    >
      <form ref={formRef} onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {formError && <FormAlert tone="error">{formError}</FormAlert>}
        <Field id="pw-current" label="Current Password" error={err("currentPassword")}>
          <PasswordInput
            ref={inputRef}
            id="pw-current"
            name="currentPassword"
            autoComplete="current-password"
            placeholder="Enter password"
            className={pwInput}
            aria-invalid={!!err("currentPassword")}
          />
        </Field>
        <Link href="/admin/forgot-password" className="-mt-3 self-start text-lead text-info hover:underline">
          Forgot Current Password? Click here
        </Link>
        <Field id="pw-new" label="New Password" hint="At least 8 characters." error={err("newPassword")}>
          <PasswordInput id="pw-new" name="newPassword" autoComplete="new-password" placeholder="Enter password" className={pwInput} aria-invalid={!!err("newPassword")} />
        </Field>
        <Field id="pw-confirm" label="Re-enter Password" error={err("confirmPassword")}>
          <PasswordInput id="pw-confirm" name="confirmPassword" autoComplete="new-password" placeholder="Enter password" className={pwInput} aria-invalid={!!err("confirmPassword")} />
        </Field>
        <p className="text-caption text-muted-foreground">Changing it signs you out on your other devices.</p>
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className={cn(primaryButton, "w-full", pending && "animate-pulse")}>
          {pending ? "Saving…" : "Save Change"}
        </button>
      </form>
    </SettingsCard>
  );
}

type Draft = Omit<ProfileData, "image" | "emailVerified" | "roleName">;

function ProfileUpdateCard({
  profile,
  maxMb,
  editing,
  setEditing,
  firstRef,
  onChangePassword,
}: {
  profile: ProfileData;
  maxMb: number;
  editing: boolean;
  setEditing: (v: boolean) => void;
  firstRef: React.Ref<HTMLInputElement>;
  onChangePassword: () => void;
}) {
  const router = useRouter();
  const initial: Draft = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
    dateOfBirth: profile.dateOfBirth,
    location: profile.location,
    bio: profile.bio,
  };
  const [draft, setDraft] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(initial);
  useUnsavedChangesGuard(dirty && !pending, { scope: "url" });

  const avatar = useImageUpload({
    maxMb,
    presign: getAvatarUploadUrl,
    finalize: (key) => setAvatarAction({ key }),
    onDone: (r) => {
      toast.success(r.image ? "Photo updated." : "Photo removed.");
      router.refresh();
    },
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const err = (k: string) => errors[k]?.[0];

  const cancel = () => {
    setDraft(initial);
    setErrors({});
    setEditing(false);
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const { email, ...rest } = draft;
      const res = await updateProfileAction(rest);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        if (!res.fieldErrors) toast.error(res.error);
        return;
      }
      if (email.trim().toLowerCase() !== profile.email) {
        const mail = await requestEmailChangeAction({ newEmail: email });
        if (!mail.ok) {
          setErrors({ email: mail.fieldErrors?.newEmail ?? [mail.error] });
          toast.success("Profile saved. The email wasn't changed.");
          router.refresh();
          return;
        }
        setNotice(mail.data.message);
      }
      setErrors({});
      setEditing(false);
      toast.success("Saved");
      router.refresh();
    });
  };

  const input = (k: keyof Draft, props: React.ComponentProps<"input"> = {}) => (
    <input
      id={`pu-${k}`}
      name={k}
      value={draft[k]}
      onChange={set(k)}
      readOnly={!editing}
      aria-invalid={!!err(k)}
      className={cn(fieldInput, "h-12 text-lead read-only:font-bold read-only:focus-visible:ring-0")}
      {...props}
    />
  );

  return (
    <SettingsCard
      title="Profile Update"
      action={
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className="press tap-target inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-lead text-foreground hover:bg-muted">
            <PencilLineIcon aria-hidden className="size-5 stroke-[1.5]" /> Edit
          </button>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-4 tablet:gap-8">
        <Avatar className="size-16">
          {profile.image && <AvatarImage src={profile.image} alt="" />}
          <AvatarFallback className="bg-secondary text-lead font-bold text-primary">{initials(`${profile.firstName} ${profile.lastName}`)}</AvatarFallback>
        </Avatar>
        <div className="flex flex-wrap gap-4">
          <input
            ref={fileRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) avatar.upload(f);
              e.target.value = "";
            }}
          />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={avatar.pending} className={cn(primaryButton, "w-30 px-0", avatar.pending && "animate-pulse")}>
            {avatar.pending ? "Uploading…" : "Upload New"}
          </button>
          <button type="button" onClick={avatar.remove} disabled={avatar.pending || !profile.image} className={cn(outlineButton, "w-30 px-0 font-medium")}>
            Delete
          </button>
        </div>
        {avatar.error && <p role="alert" className="basis-full text-caption text-destructive">{avatar.error}</p>}
      </div>

      <form onSubmit={save} noValidate className="flex flex-col gap-6">
        {notice && <FormAlert tone="success">{notice}</FormAlert>}
        <div className="grid gap-6 tablet:grid-cols-2 tablet:gap-x-5">
          <Field id="pu-firstName" label="First Name" error={err("firstName")}>
            {input("firstName", { ref: firstRef, autoComplete: "given-name", required: true })}
          </Field>
          <Field id="pu-lastName" label="Last Name" error={err("lastName")}>
            {input("lastName", { autoComplete: "family-name" })}
          </Field>
          <Field id="pu-password" label="Password">
            <div className="relative">
              <input id="pu-password" type="password" value="••••••••••" readOnly tabIndex={-1} className={cn(fieldInput, "h-12 pr-24 text-lead font-bold")} />
              <button type="button" onClick={onChangePassword} className="tap-target absolute inset-y-0 right-2 px-2 text-copy font-bold text-primary hover:underline">
                Change
              </button>
            </div>
          </Field>
          <Field id="pu-phone" label="Phone Number" error={err("phone")}>
            <div className="relative">
              {input("phone", { type: "tel", inputMode: "tel", autoComplete: "tel", placeholder: "01XXXXXXXXX", className: cn(fieldInput, "h-12 pr-24 text-lead read-only:font-bold") })}
              <span className="pointer-events-none absolute inset-y-2 right-0 flex items-center gap-1 border-l border-border px-3 text-copy text-text-body">
                <span aria-hidden>🇧🇩</span> +880
              </span>
            </div>
          </Field>
          <Field
            id="pu-email"
            label="E-mail"
            hint={editing ? (profile.emailVerified ? "Changing it sends a confirmation link first." : "Changing it sends a verification link.") : undefined}
            error={err("email")}
          >
            {input("email", { type: "email", inputMode: "email", autoComplete: "email", autoCapitalize: "none", spellCheck: false })}
          </Field>
          <Field id="pu-dateOfBirth" label="Date of Birth" error={err("dateOfBirth")}>
            {editing ? (
              input("dateOfBirth", { type: "date", max: new Date().toISOString().slice(0, 10) })
            ) : (
              <div className="relative">
                <input
                  id="pu-dateOfBirth"
                  readOnly
                  value={draft.dateOfBirth ? formatDob(draft.dateOfBirth) : ""}
                  placeholder="Not set"
                  className={cn(fieldInput, "h-12 pr-12 text-lead font-bold")}
                />
                <CalendarIcon aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-6 -translate-y-1/2 stroke-[1.5] text-foreground" />
              </div>
            )}
          </Field>
          <Field id="pu-location" label="Location" error={err("location")} className="tablet:col-span-2">
            {input("location", { autoComplete: "street-address", placeholder: editing ? "City, area" : "Not set" })}
          </Field>
          <Field id="pu-bio" label="Biography" error={err("bio")} className="tablet:col-span-2">
            <textarea
              id="pu-bio"
              name="bio"
              value={draft.bio}
              onChange={set("bio")}
              readOnly={!editing}
              maxLength={1000}
              placeholder="Enter a biography about you"
              className={cn(fieldInput, "h-29.25 resize-none py-3.5 text-lead")}
            />
          </Field>
        </div>
        {editing && (
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={cancel} disabled={pending} className={outlineButton}>
              Cancel
            </button>
            <button type="submit" disabled={pending} aria-busy={pending || undefined} className={cn(primaryButton, pending && "animate-pulse")}>
              {pending ? "Saving…" : "Save Change"}
            </button>
          </div>
        )}
      </form>
    </SettingsCard>
  );
}

/** "1999-01-12" → "12- January- 1999" (the PNG's format). */
function formatDob(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  const month = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  return `${String(d.getUTCDate()).padStart(2, "0")}- ${month}- ${d.getUTCFullYear()}`;
}
