"use client";

import { ChevronRightIcon, CirclePlusIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/shared/form-field";
import { useKeptForm } from "@/components/shared/use-kept-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { createInviteAction } from "@/lib/actions/admin-invites";
import { cn } from "@/lib/utils";

const field =
  "h-12.25 w-full min-w-0 rounded-lg border border-border bg-muted px-4 text-copy text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive";

/**
 * Add Members.png: right drawer (400 from tablet, full width on mobile) with a
 * "Control Authority › Add Members" breadcrumb, First / Last name, E-mail, Phone,
 * Assign Role, Close + Add. Deliberate difference: no "Set Initial Password"
 * block — Add sends an invite and the new member sets their own password on
 * /admin/register (an admin never knows it).
 */
export function AddMemberSheet() {
  const [open, setOpen] = useState(false);
  const { state, pending, onSubmit, err, formError } = useKeptForm(createInviteAction);

  useEffect(() => {
    if (state?.ok) {
      toast.success(`Invite sent to ${state.data.email}. The link works for 48 hours.`);
      setOpen(false); // eslint-disable-line react-hooks/set-state-in-effect -- close after a successful submit
    }
  }, [state]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="press inline-flex h-11.25 items-center gap-2 rounded-lg bg-primary px-5 text-copy font-bold text-primary-foreground hover:bg-primary-hover">
        <CirclePlusIcon aria-hidden className="size-5" /> Add Members
      </SheetTrigger>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full! max-w-none! gap-0 bg-card p-0 tablet:w-100!"
      >
        <form key={open ? "open" : "closed"} onSubmit={onSubmit} noValidate className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto px-7.5 pt-14">
            <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-lead text-muted-foreground">
              Control Authority <ChevronRightIcon aria-hidden className="size-4" />
              <span className="text-primary">Add Members</span>
            </nav>
            <SheetTitle className="mt-6 text-h2 font-bold text-foreground">Add Members</SheetTitle>
            <SheetDescription className="sr-only">Invite a staff member or admin by email.</SheetDescription>

            <div className="mt-5 flex flex-col gap-5">
              {formError && <FormAlert tone="error">{formError}</FormAlert>}
              <Field label="First Name" id="m-first" error={err("firstName")}>
                <input id="m-first" name="firstName" autoComplete="given-name" placeholder="Write here" required className={field} aria-invalid={!!err("firstName")} />
              </Field>
              <Field label="Last Name" id="m-last" error={err("lastName")}>
                <input id="m-last" name="lastName" autoComplete="family-name" placeholder="Write here" className={field} />
              </Field>
              <Field label="E-mail" id="m-email" error={err("email")}>
                <input
                  id="m-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="name@example.com"
                  required
                  className={field}
                  aria-invalid={!!err("email")}
                />
              </Field>
              <Field label="Phone Number" id="m-phone" error={err("phone")}>
                <div className="relative">
                  <input
                    id="m-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="01XXXXXXXXX"
                    className={cn(field, "pr-20")}
                    aria-invalid={!!err("phone")}
                  />
                  <span className="pointer-events-none absolute inset-y-2 right-0 flex items-center gap-1 border-l border-border px-3 text-copy text-text-body">
                    <span aria-hidden>🇧🇩</span> +880
                  </span>
                </div>
              </Field>
              <p className="rounded-lg bg-secondary px-4 py-3 text-caption text-secondary-foreground">
                They&apos;ll get an email link to set their own password. The link works once, for 48 hours.
              </p>
              <Field label="Assign Role" id="m-role" error={err("role")}>
                <Select name="role" required>
                  <SelectTrigger id="m-role" className={cn(field, "h-12.25! w-full justify-between")} aria-invalid={!!err("role")}>
                    <SelectValue placeholder="Select Here" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF">Staff (orders, products, customers)</SelectItem>
                    <SelectItem value="ADMIN">Admin (everything)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 px-7.5 pt-4 pb-[max(1.75rem,env(safe-area-inset-bottom))]">
            <SheetClose className="press h-11.25 rounded-lg border border-destructive text-copy font-bold text-destructive hover:bg-sale-soft">
              Close
            </SheetClose>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending || undefined}
              className={cn(
                "press inline-flex h-11.25 items-center justify-center gap-2 rounded-lg bg-primary text-copy font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-75",
                pending && "animate-pulse",
              )}
            >
              <CirclePlusIcon aria-hidden className="size-5" /> {pending ? "Sending…" : "Add"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <label htmlFor={id} className="text-lead text-foreground">
        {label}
      </label>
      {children}
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}
