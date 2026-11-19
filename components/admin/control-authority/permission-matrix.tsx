"use client";

import { BlendIcon, CreditCardIcon, HouseIcon, type LucideIcon, PackageSearchIcon, ShoppingCartIcon, TicketIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useUnsavedChangesGuard } from "@/components/shared/use-unsaved-guard";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { saveRolePermissionsAction } from "@/lib/actions/admin-team";
import { EXTRA_PERMISSIONS, MATRIX_ACTIONS, PERMISSION_MODULES, withImpliedReads, type Permission } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";

const MODULE_ICONS: Record<(typeof PERMISSION_MODULES)[number]["icon"], LucideIcon> = {
  dashboard: HouseIcon,
  products: PackageSearchIcon,
  orders: ShoppingCartIcon,
  customers: UsersIcon,
  coupons: TicketIcon,
  categories: BlendIcon,
  transactions: CreditCardIcon,
};

/**
 * Add Members.png "Permissions" table: mint header (Module Name | View | Create |
 * Edit | Delete), one 66-high row per module (menu icon + name), 20px checkboxes.
 * Cells a module doesn't have are an em dash. Ticking Create / Edit / Delete also
 * ticks View (the server does the same). Super Admin: all ticked, read-only.
 * Save / Discard appear once something changed (with an unsaved-changes guard).
 */
export function PermissionMatrix({ role }: { role: { id: string; name: string; isSystem: boolean; permissions: string[] } }) {
  const router = useRouter();
  const locked = role.isSystem;
  const initial = new Set(role.permissions);
  const [checked, setChecked] = useState<Set<string>>(initial);
  const [pending, start] = useTransition();

  // A different role (or a refreshed one) resets the draft.
  const key = `${role.id}:${role.permissions.join(",")}`;
  const [seen, setSeen] = useState(key);
  if (seen !== key) {
    setSeen(key);
    setChecked(new Set(role.permissions));
  }

  const dirty = !locked && (checked.size !== initial.size || [...checked].some((p) => !initial.has(p)));
  useUnsavedChangesGuard(dirty, { scope: "url" });

  const set = (p: Permission, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) {
        next.add(p);
        for (const implied of withImpliedReads([p])) next.add(implied);
      } else {
        next.delete(p);
        // Unticking View clears that module's writes too.
        const m = PERMISSION_MODULES.find((x) => x.cells.view === p);
        if (m) for (const a of MATRIX_ACTIONS) if (m.cells[a.key]) next.delete(m.cells[a.key]!);
      }
      return next;
    });

  const save = () =>
    start(async () => {
      const res = await saveRolePermissionsAction({ id: role.id, permissions: [...checked] });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Saved. Members with the ${role.name} role get these permissions on their next page load.`);
      router.refresh();
    });

  const isOn = (p: Permission) => locked || checked.has(p);

  return (
    <div className="flex flex-col gap-4">
      {/* Mobile: one card per module, its actions as labelled checkboxes. */}
      <ul className="flex flex-col divide-y divide-border tablet:hidden">
        {PERMISSION_MODULES.map((m) => {
          const Icon = MODULE_ICONS[m.icon];
          return (
            <li key={m.key} className="flex flex-col gap-2 py-3">
              <p className="flex items-center gap-2.5 text-lead text-foreground">
                <Icon aria-hidden className="size-5.5 shrink-0 stroke-[1.5] text-text-body" />
                {m.label}
              </p>
              <div className="grid grid-cols-4 gap-1">
                {MATRIX_ACTIONS.map((a) => {
                  const p = m.cells[a.key];
                  return p ? (
                    <Label key={a.key} className="tap-target flex-col gap-1 text-caption font-normal text-text-body">
                      <Checkbox checked={isOn(p)} disabled={locked || pending} onCheckedChange={(v) => set(p, v === true)} className="size-5" />
                      {a.label}
                    </Label>
                  ) : (
                    <span key={a.key} className="flex flex-col items-center gap-1 text-caption text-muted-foreground">
                      <span aria-hidden>—</span>
                      <span className="sr-only">{a.label}: </span>n/a
                    </span>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="hidden overflow-x-auto tablet:block">
        <table className="w-full min-w-130 table-fixed border-collapse text-left">
          <caption className="sr-only">Permissions of the {role.name} role</caption>
          <thead>
            <tr className="bg-secondary">
              <th scope="col" className="h-14 rounded-l-lg px-4.5 text-lead font-normal text-secondary-foreground">
                Module Name
              </th>
              {MATRIX_ACTIONS.map((a, i) => (
                <th
                  key={a.key}
                  scope="col"
                  className={cn("h-14 w-[12.75%] text-center text-lead font-normal text-secondary-foreground", i === MATRIX_ACTIONS.length - 1 && "rounded-r-lg")}
                >
                  {a.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((m) => {
              const Icon = MODULE_ICONS[m.icon];
              return (
                <tr key={m.key} className="border-b border-border last:border-b-0">
                  <th scope="row" className="h-16.5 px-4.5 text-lead font-normal text-foreground">
                    <span className="flex items-center gap-2.5">
                      <Icon aria-hidden className="size-5.5 shrink-0 stroke-[1.5] text-text-body" />
                      {m.label}
                    </span>
                  </th>
                  {MATRIX_ACTIONS.map((a) => {
                    const p = m.cells[a.key];
                    return (
                      <td key={a.key} className="text-center">
                        {p ? (
                          <Label className="tap-target inline-flex justify-center p-2.5">
                            <Checkbox
                              checked={isOn(p)}
                              disabled={locked || pending}
                              onCheckedChange={(v) => set(p, v === true)}
                              aria-label={`${m.label}: ${a.label}`}
                              className="size-5"
                            />
                          </Label>
                        ) : (
                          <span aria-label="Not applicable" className="text-muted-foreground">
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <fieldset className="flex flex-col gap-2 border-t border-border pt-4">
        <legend className="text-copy font-bold text-foreground">Other permissions</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {EXTRA_PERMISSIONS.map((x) => (
            <Label key={x.permission} className="tap-target gap-2 text-copy font-normal text-foreground">
              <Checkbox checked={isOn(x.permission)} disabled={locked || pending} onCheckedChange={(v) => set(x.permission, v === true)} />
              {x.label}
            </Label>
          ))}
        </div>
        {locked && (
          <p className="text-caption text-muted-foreground">Super Admins always have every permission, including team management and store settings.</p>
        )}
        {!locked && <p className="text-caption text-muted-foreground">Team management and store settings are Super Admin only.</p>}
      </fieldset>

      {dirty && (
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg bg-warning-soft px-4 py-3">
          <p className="mr-auto text-copy text-foreground">Unsaved permission changes for {role.name}.</p>
          <button
            type="button"
            disabled={pending}
            onClick={() => setChecked(new Set(role.permissions))}
            className="press tap-target h-10 rounded-lg border border-border bg-card px-4 text-copy font-bold text-foreground hover:bg-muted"
          >
            Discard
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className={cn("press tap-target h-10 rounded-lg bg-primary px-4 text-copy font-bold text-primary-foreground hover:bg-primary-hover", pending && "animate-pulse")}
          >
            {pending ? "Saving…" : "Save permissions"}
          </button>
        </div>
      )}
    </div>
  );
}
