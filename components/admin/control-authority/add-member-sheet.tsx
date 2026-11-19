"use client";

import { CirclePlusIcon, UserRoundCheckIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/shared/form-field";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createInviteAction } from "@/lib/actions/admin-invites";
import { cn } from "@/lib/utils";
import { DrawerField, DrawerForm, DrawerFrame, drawerField, drawerPrimary } from "./drawer-frame";

/**
 * Add Members.png drawer: First / Last name, E-mail, Phone, Assign Role, Close + Add.
 * Deliberate differences: no "Set Initial Password" (Add sends a 48h single-use
 * invite; the member sets their own password on /admin/register), and the phone
 * is BD (+880) instead of the PNG's US flag. An email that already has a customer
 * account asks "Upgrade to staff?" first.
 */
export function AddMemberSheet({
  roles,
  defaultRoleId,
  variant = "page",
}: {
  roles: { id: string; name: string }[];
  defaultRoleId?: string | null;
  /** "page": big green button (header); "card": the Members card's small outlined button. */
  variant?: "page" | "card";
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "press inline-flex shrink-0 items-center gap-2 rounded-lg font-bold",
          variant === "page"
            ? "tap-target h-12 bg-primary px-3 text-lead text-primary-foreground hover:bg-primary-hover"
            : "tap-target h-8 border border-primary px-2 text-copy text-primary hover:bg-secondary",
        )}
      >
        <CirclePlusIcon aria-hidden className={variant === "page" ? "size-6" : "size-5"} /> Add Members
      </button>
      <DrawerFrame open={open} onOpenChange={setOpen}>
        <AddMemberForm roles={roles} defaultRoleId={defaultRoleId} onDone={close} />
      </DrawerFrame>
    </>
  );
}

function AddMemberForm({
  roles,
  defaultRoleId,
  onDone,
}: {
  roles: { id: string; name: string }[];
  defaultRoleId?: string | null;
  onDone: () => void;
}) {
  const [upgrade, setUpgrade] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const { state, pending, onSubmit, err, formError } = useKeptForm(createInviteAction);
  const needsUpgrade = state?.ok && state.data.needsUpgrade;

  useEffect(() => {
    if (state?.ok && !state.data.needsUpgrade) {
      toast.success(`Invite sent to ${state.data.email}. The link works once, for 48 hours.`);
      onDone();
    }
  }, [state, onDone]);

  // Resubmit once the hidden "upgrade" field has rendered.
  useEffect(() => {
    if (upgrade) formRef.current?.requestSubmit();
  }, [upgrade]);

  return (
    <DrawerForm
      title="Add Members"
      description="Invite a team member by email. They set their own password."
      formRef={formRef}
      onSubmit={onSubmit}
      onClose={onDone}
      primary={
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className={cn(drawerPrimary, pending && "animate-pulse")}>
          <CirclePlusIcon aria-hidden className="size-5" /> {pending ? "Sending…" : "Add"}
        </button>
      }
    >
        <input type="hidden" name="upgrade" value={upgrade ? "1" : ""} />
      {formError && <FormAlert tone="error">{formError}</FormAlert>}
      {needsUpgrade && !upgrade && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg bg-warning-soft px-4 py-3 text-copy text-foreground">
          <p>
            <strong>{state.data.email}</strong> already has a customer account. Upgrade it to staff? Their orders and addresses stay; accepting the
            invite sets a new password.
          </p>
          <button
            type="button"
            onClick={() => {
              setUpgrade(true);
            }}
            className="press inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg bg-primary px-4 font-bold text-primary-foreground hover:bg-primary-hover"
          >
            <UserRoundCheckIcon aria-hidden className="size-5" /> Upgrade to staff
          </button>
        </div>
      )}
      <DrawerField label="First Name" id="m-first" error={err("firstName")}>
        <input id="m-first" name="firstName" autoComplete="off" placeholder="Write here" required className={drawerField} aria-invalid={!!err("firstName")} />
      </DrawerField>
      <DrawerField label="Last Name" id="m-last" error={err("lastName")}>
        <input id="m-last" name="lastName" autoComplete="off" placeholder="Write here" className={drawerField} />
      </DrawerField>
      <DrawerField label="E-mail" id="m-email" error={err("email")}>
        <input
          id="m-email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="demo@gmail.com"
          required
          onChange={() => upgrade && setUpgrade(false)}
          className={drawerField}
          aria-invalid={!!err("email")}
        />
      </DrawerField>
      <DrawerField label="Phone Number" id="m-phone" error={err("phone")}>
        <div className="relative">
          <input id="m-phone" name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="01XXXXXXXXX" className={cn(drawerField, "pr-22")} aria-invalid={!!err("phone")} />
          <span className="pointer-events-none absolute inset-y-2 right-0 flex items-center gap-1 border-l border-border px-3 text-copy text-text-body">
            <span aria-hidden>🇧🇩</span> +880
          </span>
        </div>
      </DrawerField>
      <p className="rounded-lg bg-secondary px-4 py-3 text-caption text-secondary-foreground">
        They&apos;ll get an email link to set their own password. The link works once, for 48 hours.
      </p>
      <DrawerField label="Assign Role" id="m-role" error={err("staffRoleId")}>
        <Select name="staffRoleId" required defaultValue={defaultRoleId ?? undefined}>
          <SelectTrigger id="m-role" className={cn(drawerField, "h-12.25! w-full justify-between")} aria-invalid={!!err("staffRoleId")}>
            <SelectValue placeholder="Select Here" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DrawerField>
    </DrawerForm>
  );
}
