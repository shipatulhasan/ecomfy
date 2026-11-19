"use client";

import { BanIcon, EllipsisIcon, MailIcon, RotateCcwIcon, ShieldCheckIcon, UserMinusIcon, UserRoundCheckIcon, XCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { BottomSheet } from "@/components/shared/bottom-sheet";
import { ResponsiveModal } from "@/components/shared/responsive-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { ActionResult } from "@/lib/actions/result";
import { resendInviteAction, revokeInviteAction } from "@/lib/actions/admin-invites";
import { changeMemberRoleAction, removeMemberAction, setMemberActiveAction } from "@/lib/actions/admin-team";
import type { TeamInviteRow, TeamMemberRow } from "@/lib/queries/admin/team";
import { cn } from "@/lib/utils";

const iconBtn = "tap-target grid size-8 place-items-center rounded-md text-text-body transition-colors hover:bg-muted hover:text-foreground";
const sheetItem = "press flex h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-lead text-foreground hover:bg-muted disabled:opacity-50";

type Row = TeamMemberRow | TeamInviteRow;
type Confirm = "deactivate" | "remove" | "revoke" | null;

/** Shared state for both shells (laptop dropdown, mobile bottom sheet). */
function useMemberActions(row: Row) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [roleOpen, setRoleOpen] = useState(false);

  const run = <T,>(fn: () => Promise<ActionResult<T>>, done: string) =>
    start(async () => {
      const res = await fn();
      setConfirm(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRoleOpen(false);
      toast.success(done);
      router.refresh();
    });

  const isMember = row.kind === "member";
  return {
    row,
    pending,
    confirm,
    setConfirm,
    roleOpen,
    setRoleOpen,
    resend: () => run(() => resendInviteAction({ id: row.id }), `New invite sent to ${row.email}. The old link no longer works.`),
    revoke: () => run(() => revokeInviteAction({ id: row.id }), `Invite for ${row.email} revoked.`),
    reactivate: () => isMember && run(() => setMemberActiveAction({ userId: row.id, active: true }), `${row.name} can sign in again.`),
    deactivate: () => run(() => setMemberActiveAction({ userId: row.id, active: false }), `${row.name} is deactivated and signed out everywhere.`),
    remove: () => run(() => removeMemberAction({ userId: row.id }), `${row.name} was removed from the team.`),
    changeRole: (staffRoleId: string) => run(() => changeMemberRoleAction({ userId: row.id, staffRoleId }), `${row.name}'s role was changed.`),
  };
}

type Actions = ReturnType<typeof useMemberActions>;

/** Laptop: "⋯" dropdown in the members table. */
export function MemberRowActions({ row, roles, isSelf }: { row: Row; roles: { id: string; name: string }[]; isSelf: boolean }) {
  const a = useMemberActions(row);
  if (isSelf) return <span className="text-caption text-muted-foreground">You</span>;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={`Actions for ${row.name || row.email}`} className={iconBtn} disabled={a.pending}>
          <EllipsisIcon aria-hidden className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          {row.kind === "invite" ? (
            <>
              <DropdownMenuItem onSelect={a.resend}>
                <MailIcon aria-hidden /> Resend invite
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={() => a.setConfirm("revoke")}>
                <XCircleIcon aria-hidden /> Revoke invite
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem onSelect={() => a.setRoleOpen(true)}>
                <ShieldCheckIcon aria-hidden /> Change role
              </DropdownMenuItem>
              {row.active ? (
                <DropdownMenuItem onSelect={() => a.setConfirm("deactivate")}>
                  <BanIcon aria-hidden /> Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={a.reactivate}>
                  <UserRoundCheckIcon aria-hidden /> Reactivate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => a.setConfirm("remove")}>
                <UserMinusIcon aria-hidden /> Remove from team
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialogs a={a} roles={roles} />
    </>
  );
}

/** Below laptop: the card's "⋯" opens the same list in a bottom sheet. */
export function MemberRowActionsSheet({ row, roles, isSelf }: { row: Row; roles: { id: string; name: string }[]; isSelf: boolean }) {
  const a = useMemberActions(row);
  const [open, setOpen] = useState(false);
  if (isSelf) return <span className="text-caption text-muted-foreground">You</span>;
  const pick = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  return (
    <>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title={row.name || row.email}
        description={row.email}
        trigger={
          <button type="button" aria-label={`Actions for ${row.name || row.email}`} className={iconBtn} disabled={a.pending}>
            <EllipsisIcon aria-hidden className="size-5" />
          </button>
        }
      >
        <div className="flex flex-col gap-1 pb-2">
          {row.kind === "invite" ? (
            <>
              <button type="button" className={sheetItem} onClick={pick(a.resend)}>
                <MailIcon aria-hidden className="size-5" /> Resend invite
              </button>
              <button type="button" className={cn(sheetItem, "text-destructive")} onClick={pick(() => a.setConfirm("revoke"))}>
                <XCircleIcon aria-hidden className="size-5" /> Revoke invite
              </button>
            </>
          ) : (
            <>
              <button type="button" className={sheetItem} onClick={pick(() => a.setRoleOpen(true))}>
                <ShieldCheckIcon aria-hidden className="size-5" /> Change role
              </button>
              {row.active ? (
                <button type="button" className={sheetItem} onClick={pick(() => a.setConfirm("deactivate"))}>
                  <BanIcon aria-hidden className="size-5" /> Deactivate
                </button>
              ) : (
                <button type="button" className={sheetItem} onClick={pick(a.reactivate)}>
                  <RotateCcwIcon aria-hidden className="size-5" /> Reactivate
                </button>
              )}
              <button type="button" className={cn(sheetItem, "text-destructive")} onClick={pick(() => a.setConfirm("remove"))}>
                <UserMinusIcon aria-hidden className="size-5" /> Remove from team
              </button>
            </>
          )}
        </div>
      </BottomSheet>
      <Dialogs a={a} roles={roles} />
    </>
  );
}

const CONFIRM_COPY = {
  deactivate: {
    title: "Deactivate this member?",
    body: "They're signed out on every device right away and can't sign in until you reactivate them. Their history stays.",
    action: "Deactivate",
  },
  remove: {
    title: "Remove from the team?",
    body: "They lose admin access and are signed out everywhere. The account stays as a customer account, so audit entries and orders keep their name.",
    action: "Remove",
  },
  revoke: { title: "Revoke this invite?", body: "The link stops working right away.", action: "Revoke" },
} as const;

function Dialogs({ a, roles }: { a: Actions; roles: { id: string; name: string }[] }) {
  const copy = a.confirm ? CONFIRM_COPY[a.confirm] : null;
  const onConfirm = a.confirm === "deactivate" ? a.deactivate : a.confirm === "remove" ? a.remove : a.revoke;
  return (
    <>
      <AlertDialog open={!!a.confirm} onOpenChange={(o) => !o && a.setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{a.row.name || a.row.email}</strong> · {copy?.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={a.pending}
              onClick={(e) => {
                e.preventDefault(); // keep it open until the action settles
                onConfirm();
              }}
            >
              {a.pending ? "Working…" : copy?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {a.row.kind === "member" && <RoleDialog a={a} roles={roles} current={a.row.staffRoleId} />}
    </>
  );
}

function RoleDialog({ a, roles, current }: { a: Actions; roles: { id: string; name: string }[]; current: string | null }) {
  const [value, setValue] = useState(current ?? "");
  return (
    <ResponsiveModal
      open={a.roleOpen}
      onOpenChange={a.setRoleOpen}
      title="Change role"
      description={`${a.row.name} · ${a.row.email}. They're signed out so the new permissions apply on their next sign-in.`}
      className="laptop:max-w-110"
      footer={
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => a.setRoleOpen(false)} className="press tap-target h-11 rounded-lg border border-border px-5 text-copy font-bold text-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            disabled={a.pending || !value || value === current}
            onClick={() => a.changeRole(value)}
            className={cn("press tap-target h-11 rounded-lg bg-primary px-5 text-copy font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-60", a.pending && "animate-pulse")}
          >
            {a.pending ? "Saving…" : "Save role"}
          </button>
        </div>
      }
    >
      <RadioGroup value={value} onValueChange={setValue} className="gap-1">
        {roles.map((r) => (
          <Label key={r.id} className="tap-target h-12 gap-3 rounded-lg px-3 text-lead font-normal text-foreground hover:bg-muted has-data-[state=checked]:bg-secondary">
            <RadioGroupItem value={r.id} /> {r.name}
            {r.id === current && <span className="ml-auto text-caption text-muted-foreground">Current</span>}
          </Label>
        ))}
      </RadioGroup>
    </ResponsiveModal>
  );
}
