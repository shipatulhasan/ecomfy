"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FormAlert } from "@/components/shared/form-field";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { deleteRoleAction, saveRoleAction } from "@/lib/actions/admin-team";
import { teamHref, type TeamParams } from "@/lib/admin/team/params";
import { MATRIX_ACTIONS, PERMISSION_MODULES, type MatrixAction, type Permission } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { DrawerField, DrawerForm, DrawerFrame, drawerField, drawerPrimary } from "./drawer-frame";

type EditingRole = { id: string; name: string; description: string | null; activeUsers: number };

/**
 * Create New Role.png (URL-driven: ?new=role, or ?edit=<id> for name/description).
 * Create: Role name, Role Description, Permissions (View / Create / Edit / Delete)
 * × Module checkboxes → every existing module/action pair. Fine-tuning is the
 * Permissions table on the page. Edit also offers Delete (custom roles with no
 * members).
 */
export function RoleSheet({ params, editing }: { params: TeamParams; editing: EditingRole | null }) {
  const router = useRouter();
  const open = params.modal?.kind === "new" || (params.modal?.kind === "edit" && !!editing);
  const close = () => router.replace(teamHref(params, { modal: null }), { scroll: false });
  return (
    <DrawerFrame open={open} onOpenChange={(o) => !o && close()}>
      {open && <RoleForm key={editing?.id ?? "new"} params={params} editing={params.modal?.kind === "edit" ? editing : null} onClose={close} />}
    </DrawerFrame>
  );
}

function RoleForm({ params, editing, onClose }: { params: TeamParams; editing: EditingRole | null; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [actions, setActions] = useState<Set<MatrixAction>>(new Set(["view"]));
  const [modules, setModules] = useState<Set<string>>(new Set(["dashboard"]));
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const toggle = <T,>(set: Set<T>, v: T, on: boolean) => {
    const next = new Set(set);
    if (on) next.add(v);
    else next.delete(v);
    return next;
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const permissions = editing
      ? undefined
      : PERMISSION_MODULES.filter((m) => modules.has(m.key)).flatMap((m) => [...actions].map((a) => m.cells[a]).filter((p): p is Permission => !!p));
    start(async () => {
      const res = await saveRoleAction({ id: editing?.id, name: fd.get("name"), description: fd.get("description"), permissions });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.fieldErrors ? null : res.error);
        return;
      }
      toast.success(editing ? "Role updated." : "Role created. Fine-tune it in the Permissions table.");
      router.replace(teamHref(params, { modal: null, role: res.data.id }), { scroll: false });
    });
  };

  const remove = () =>
    start(async () => {
      const res = await deleteRoleAction({ id: editing!.id });
      if (!res.ok) {
        setConfirmDelete(false);
        setFormError(res.error);
        return;
      }
      toast.success(`Role "${editing!.name}" deleted.`);
      router.replace(teamHref(params, { modal: null, role: null }), { scroll: false });
    });

  const err = (k: string) => errors[k]?.[0];

  return (
    <DrawerForm
      title={editing ? "Edit Role" : "Create New Role"}
      description={editing ? "Rename the role or change its description." : "Name the role and choose what it can do."}
      onSubmit={onSubmit}
      onClose={onClose}
      primary={
        <button type="submit" disabled={pending} aria-busy={pending || undefined} className={cn(drawerPrimary, pending && "animate-pulse")}>
          {pending ? "Saving…" : "Save"}
        </button>
      }
    >
      {formError && <FormAlert tone="error">{formError}</FormAlert>}
      <DrawerField label="Role name" id="r-name" error={err("name")}>
        <input id="r-name" name="name" defaultValue={editing?.name} placeholder="Enter role name" required maxLength={40} className={drawerField} aria-invalid={!!err("name")} />
      </DrawerField>
      <DrawerField label="Role Description" id="r-desc" error={err("description")}>
        <textarea
          id="r-desc"
          name="description"
          defaultValue={editing?.description ?? ""}
          placeholder="Enter role description"
          maxLength={160}
          rows={4}
          className={cn(drawerField, "h-29.25 resize-none py-3")}
        />
      </DrawerField>

      {!editing && (
        <>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-lead text-foreground">Permissions</legend>
            <div className="flex flex-wrap gap-x-2.5 gap-y-2">
              {MATRIX_ACTIONS.map((a) => (
                <Label key={a.key} className="tap-target gap-1.5 text-copy font-normal text-foreground">
                  <Checkbox checked={actions.has(a.key)} onCheckedChange={(v) => setActions((s) => toggle(s, a.key, v === true))} />
                  {a.label}
                </Label>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-3 text-lead text-foreground">Module</legend>
            <div className="grid grid-cols-[auto_auto] justify-start gap-x-2.5 gap-y-1.5">
              {PERMISSION_MODULES.map((m) => (
                <Label key={m.key} className="tap-target gap-1.5 text-copy font-normal text-foreground">
                  <Checkbox checked={modules.has(m.key)} onCheckedChange={(v) => setModules((s) => toggle(s, m.key, v === true))} />
                  {m.label}
                </Label>
              ))}
            </div>
            <p className="text-caption text-muted-foreground">Actions a module doesn&apos;t have (e.g. deleting orders) are skipped.</p>
          </fieldset>
        </>
      )}

      {editing && (
        <div className="flex flex-col gap-2 border-t border-border pt-5">
          <p className="text-copy text-muted-foreground">
            {editing.activeUsers > 0
              ? `${editing.activeUsers} member(s) have this role. Move them to another role before deleting it.`
              : "No one has this role. Pending invites for it are revoked when it's deleted."}
          </p>
          <button
            type="button"
            disabled={pending || editing.activeUsers > 0}
            onClick={() => setConfirmDelete(true)}
            className="tap-target self-start rounded-md px-0 text-copy font-bold text-destructive hover:underline disabled:opacity-50 disabled:hover:no-underline"
          >
            Delete role
          </button>
          <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{editing.name}”?</AlertDialogTitle>
                <AlertDialogDescription>This can&apos;t be undone. Pending invites for this role are revoked.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={remove} disabled={pending}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </DrawerForm>
  );
}
