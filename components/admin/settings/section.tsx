"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/shared/form-field";
import { useUnsavedChangesGuard } from "@/components/shared/use-unsaved-guard";
import type { ActionResult } from "@/lib/actions/result";
import { cn } from "@/lib/utils";

/** Account & Settings.png card: white, 12 radius, 24–30 padding, 26-high title. */
export function SettingsCard({
  title,
  description,
  action,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & { title: React.ReactNode; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col gap-5 rounded-xl bg-card p-4 tablet:px-7.5 tablet:py-6", className)} {...props}>
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="text-h2 text-foreground">{title}</h3>
          {description && <p className="text-copy text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export const primaryButton =
  "press tap-target inline-flex h-10.5 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-lead font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-60";
export const outlineButton =
  "press tap-target inline-flex h-10.5 items-center justify-center gap-2 rounded-lg border border-border bg-card px-5 text-lead font-bold text-foreground hover:bg-muted disabled:opacity-60";

/**
 * Draft state for one settings section: edit freely, Save sends the whole
 * section to its server action, "Saved" toast + refresh. Leaving with unsaved
 * changes (another tab, another page, reload) asks first.
 */
export function useSection<T>(initial: T, save: (values: T) => Promise<ActionResult<unknown>>) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Fresh server values (after a save + refresh, or another admin's change) replace a clean draft.
  const incoming = JSON.stringify(initial);
  const [seen, setSeen] = useState(incoming);
  if (seen !== incoming) {
    setSeen(incoming);
    setBaseline(initial);
    if (JSON.stringify(values) === JSON.stringify(baseline)) setValues(initial);
  }

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  useUnsavedChangesGuard(dirty && !pending, { scope: "url" });

  const set = <K extends keyof T>(key: K, value: T[K]) => setValues((v) => ({ ...v, [key]: value }));

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    start(async () => {
      const res = await save(values);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.fieldErrors ? null : res.error);
        if (res.fieldErrors) toast.error("Please fix the highlighted fields.");
        return;
      }
      setErrors({});
      setFormError(null);
      setBaseline(values);
      toast.success("Saved");
      router.refresh();
    });
  };

  const reset = () => {
    setValues(baseline);
    setErrors({});
    setFormError(null);
  };

  return { values, set, setValues, dirty, pending, errors, formError, err: (k: string) => errors[k]?.[0], submit, reset };
}

/** Bottom bar of a section form: unsaved hint, Discard, Save. */
export function SectionActions({ dirty, pending, onReset, label = "Save changes" }: { dirty: boolean; pending: boolean; onReset: () => void; label?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
      {dirty && <p className="mr-auto text-copy text-warning-strong">Unsaved changes</p>}
      {dirty && (
        <button type="button" onClick={onReset} disabled={pending} className={outlineButton}>
          Discard
        </button>
      )}
      <button type="submit" disabled={pending || !dirty} aria-busy={pending || undefined} className={cn(primaryButton, pending && "animate-pulse")}>
        {pending ? "Saving…" : label}
      </button>
    </div>
  );
}

export function SectionError({ message }: { message: string | null }) {
  return message ? <FormAlert tone="error">{message}</FormAlert> : null;
}
