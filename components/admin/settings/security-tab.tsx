"use client";

import { DownloadIcon, LaptopIcon, MonitorSmartphoneIcon, ShieldCheckIcon, ShieldOffIcon, SmartphoneIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Field, fieldInput } from "@/components/admin/products/form/fields";
import { CopyButton } from "@/components/admin/orders/detail/forms";
import { FormAlert } from "@/components/shared/form-field";
import { PasswordInput } from "@/components/shop/auth/password-input";
import {
  confirmTwoFactorAction,
  disableTwoFactorAction,
  regenerateBackupCodesAction,
  revokeOtherSessionsAction,
  revokeSessionAction,
  startTwoFactorAction,
} from "@/lib/actions/admin-account";
import { cn } from "@/lib/utils";
import { outlineButton, primaryButton, SettingsCard } from "./section";

export type SessionRow = {
  id: string;
  device: string;
  kind: "mobile" | "desktop" | "other";
  ip: string | null;
  lastActive: string;
  createdAt: string;
  current: boolean;
};

const pwInput = cn(fieldInput, "h-12 bg-muted pr-13 text-lead");

/** Security (derived tab, no PNG): 2FA (TOTP + backup codes) and active sessions, in the PNG's card style. */
export function SecurityTab({ twoFactorEnabled, sessions }: { twoFactorEnabled: boolean; sessions: SessionRow[] }) {
  return (
    <div className="grid gap-5 laptop:grid-cols-2 laptop:items-start">
      <TwoFactorCard enabled={twoFactorEnabled} />
      <SessionsCard sessions={sessions} />
    </div>
  );
}

type Step = { kind: "idle" } | { kind: "password"; intent: "enable" | "disable" | "codes" } | { kind: "scan"; qr: string; secret: string; backupCodes: string[] } | { kind: "codes"; backupCodes: string[] };

function TwoFactorCard({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const withPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== "password") return;
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    start(async () => {
      setError(null);
      if (step.intent === "enable") {
        const res = await startTwoFactorAction({ password });
        if (!res.ok) return setError(res.error);
        setStep({ kind: "scan", ...res.data });
      } else if (step.intent === "disable") {
        const res = await disableTwoFactorAction({ password });
        if (!res.ok) return setError(res.error);
        setStep({ kind: "idle" });
        toast.success("Two-step verification is off.");
        router.refresh();
      } else {
        const res = await regenerateBackupCodesAction({ password });
        if (!res.ok) return setError(res.error);
        setStep({ kind: "codes", backupCodes: res.data.backupCodes });
      }
    });
  };

  const confirm = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (step.kind !== "scan") return;
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    start(async () => {
      setError(null);
      const res = await confirmTwoFactorAction({ code });
      if (!res.ok) return setError(res.fieldErrors?.code?.[0] ?? res.error);
      toast.success("Two-step verification is on.");
      setStep({ kind: "codes", backupCodes: step.backupCodes });
      router.refresh();
    });
  };

  return (
    <SettingsCard
      title="Two-step verification"
      description="After your password, sign-in asks for a code from an authenticator app (Google Authenticator, 1Password, Authy…)."
    >
      <div className={cn("flex items-center gap-3 rounded-lg px-4 py-3", enabled ? "bg-success-soft" : "bg-muted")}>
        {enabled ? <ShieldCheckIcon aria-hidden className="size-6 text-primary" /> : <ShieldOffIcon aria-hidden className="size-6 text-text-body" />}
        <p className="text-copy text-foreground">
          <strong>{enabled ? "On" : "Off"}</strong> · {enabled ? "a code is required at every new sign-in." : "only your password protects this account."}
        </p>
      </div>
      {error && <FormAlert tone="error">{error}</FormAlert>}

      {step.kind === "idle" && (
        <div className="flex flex-wrap gap-3">
          {enabled ? (
            <>
              <button type="button" className={outlineButton} onClick={() => setStep({ kind: "password", intent: "codes" })}>
                New backup codes
              </button>
              <button type="button" className={cn(outlineButton, "border-destructive text-destructive hover:bg-sale-soft")} onClick={() => setStep({ kind: "password", intent: "disable" })}>
                Turn off
              </button>
            </>
          ) : (
            <button type="button" className={primaryButton} onClick={() => setStep({ kind: "password", intent: "enable" })}>
              Set up two-step verification
            </button>
          )}
        </div>
      )}

      {step.kind === "password" && (
        <form onSubmit={withPassword} noValidate className="flex flex-col gap-4">
          <Field id="tf-password" label="Confirm your password">
            <PasswordInput id="tf-password" name="password" autoComplete="current-password" placeholder="Enter password" autoFocus required className={pwInput} />
          </Field>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className={outlineButton} onClick={() => setStep({ kind: "idle" })} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className={cn(primaryButton, pending && "animate-pulse")} disabled={pending}>
              {pending ? "Checking…" : "Continue"}
            </button>
          </div>
        </form>
      )}

      {step.kind === "scan" && (
        <form onSubmit={confirm} noValidate className="flex flex-col gap-4">
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-copy text-text-body">
            <li>Scan the QR code with your authenticator app (or enter the key).</li>
            <li>Type the 6-digit code it shows to finish.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-5">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URL generated on the server, not a remote image */}
            <img src={step.qr} alt="QR code for your authenticator app" width={176} height={176} className="size-44 rounded-lg border border-border bg-card p-2" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-caption text-muted-foreground">Setup key</p>
              <div className="flex items-center gap-1">
                <code className="min-w-0 truncate rounded bg-muted px-2 py-1 text-caption text-foreground">{step.secret}</code>
                <CopyButton value={step.secret} label="Copy setup key" />
              </div>
            </div>
          </div>
          <Field id="tf-code" label="Code from the app">
            <input id="tf-code" name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123 456" autoFocus required className={cn(fieldInput, "h-12 text-lead tracking-widest")} />
          </Field>
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" className={outlineButton} onClick={() => setStep({ kind: "idle" })} disabled={pending}>
              Cancel
            </button>
            <button type="submit" className={cn(primaryButton, pending && "animate-pulse")} disabled={pending}>
              {pending ? "Verifying…" : "Turn on"}
            </button>
          </div>
        </form>
      )}

      {step.kind === "codes" && <BackupCodes codes={step.backupCodes} onDone={() => setStep({ kind: "idle" })} />}
    </SettingsCard>
  );
}

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = codes.join("\n");
  const download = () => {
    const url = URL.createObjectURL(new Blob([`Ecofy admin backup codes (each works once)\n\n${text}\n`], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "ecofy-backup-codes.txt" });
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="flex flex-col gap-4">
      <FormAlert tone="success">Save these backup codes somewhere safe. Each one signs you in once if you lose your phone. They won&apos;t be shown again.</FormAlert>
      <ul className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4 font-mono text-copy text-foreground tablet:grid-cols-3">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-3">
        <CopyButton value={text} label="Copy backup codes" className="size-10.5 border border-border" />
        <button type="button" className={outlineButton} onClick={download}>
          <DownloadIcon aria-hidden className="size-5" /> Download
        </button>
        <button type="button" className={primaryButton} onClick={onDone}>
          I saved them
        </button>
      </div>
    </div>
  );
}

function SessionsCard({ sessions }: { sessions: SessionRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const others = sessions.filter((s) => !s.current).length;

  const revoke = (id: string) =>
    start(async () => {
      const res = await revokeSessionAction({ id });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Signed out that device.");
      router.refresh();
    });
  const revokeOthers = () =>
    start(async () => {
      const res = await revokeOtherSessionsAction();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.data.count ? `Signed out ${res.data.count} other device${res.data.count === 1 ? "" : "s"}.` : "No other devices were signed in.");
      router.refresh();
    });

  return (
    <SettingsCard title="Active sessions" description="Devices signed in to your account. Sign out any you don't recognise, then change your password.">
      <ul className="flex flex-col divide-y divide-border">
        {sessions.map((s) => {
          const Icon = s.kind === "mobile" ? SmartphoneIcon : s.kind === "desktop" ? LaptopIcon : MonitorSmartphoneIcon;
          return (
            <li key={s.id} className="flex items-center gap-3 py-3">
              <Icon aria-hidden className="size-6 shrink-0 stroke-[1.5] text-text-body" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-copy font-bold text-foreground">
                  {s.device}
                  {s.current && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-caption text-primary">This device</span>}
                </p>
                <p className="truncate text-caption text-muted-foreground">
                  {s.ip ?? "Unknown IP"} · active {s.lastActive} · signed in {s.createdAt}
                </p>
              </div>
              {!s.current && (
                <button type="button" disabled={pending} onClick={() => revoke(s.id)} className="tap-target rounded-md px-2 text-copy font-bold text-destructive hover:bg-sale-soft disabled:opacity-60">
                  Sign out
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button type="button" disabled={pending || others === 0} onClick={revokeOthers} className={cn(outlineButton, "self-start", pending && "animate-pulse")}>
        Sign out other devices{others ? ` (${others})` : ""}
      </button>
    </SettingsCard>
  );
}
