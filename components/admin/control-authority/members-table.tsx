import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDhaka } from "@/lib/admin/date-range";
import type { TeamInviteRow, TeamMemberRow } from "@/lib/queries/admin/team";
import { cn } from "@/lib/utils";
import { MemberRowActions, MemberRowActionsSheet } from "./member-actions";

type Row = TeamMemberRow | TeamInviteRow;

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

const date = (d: Date | null) => (d ? formatDhaka(d, "dd MMM yyyy") : "—");
const dateTime = (d: Date | null) => (d ? formatDhaka(d, "dd MMM yyyy, h:mm a") : "Never");

function StatusPill({ row }: { row: Row }) {
  const [label, cls] =
    row.kind === "invite"
      ? (["Invited", "bg-info-soft text-info-strong"] as const)
      : row.active
        ? (["Active", "bg-success-soft text-primary"] as const)
        : (["Deactivated", "bg-sale-soft text-destructive"] as const);
  return <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-caption font-bold whitespace-nowrap", cls)}>{label}</span>;
}

function Person({ row }: { row: Row }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0">
        {row.kind === "member" && row.image && <AvatarImage src={row.image} alt="" />}
        <AvatarFallback className="bg-secondary text-caption font-bold text-primary">{initials(row.name || row.email)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-copy font-bold text-foreground">{row.name || "—"}</p>
        <p className="truncate text-caption text-muted-foreground">{row.email}</p>
      </div>
    </div>
  );
}

/**
 * All members (derived; not in the PNG): table from laptop (Member · Role · Status
 * · Last active · Joined · ⋯), cards below. Pending invites are rows with status
 * "Invited" (Resend / Revoke); their "Joined" column shows when the link expires.
 */
export function MembersTable({ rows, roles, selfId }: { rows: Row[]; roles: { id: string; name: string }[]; selfId: string }) {
  if (rows.length === 0) {
    return <p className="rounded-lg bg-muted px-4 py-8 text-center text-copy text-muted-foreground">No members match these filters.</p>;
  }
  return (
    <>
      <div className="hidden overflow-x-auto laptop:block">
        <table className="w-full min-w-215 table-fixed text-left">
          <thead className="bg-secondary">
            <tr className="h-14 text-lead text-secondary-foreground">
              <th scope="col" className="rounded-l-lg px-4 font-normal">Member</th>
              <th scope="col" className="w-44 px-3 font-normal">Role</th>
              <th scope="col" className="w-32 px-3 font-normal">Status</th>
              <th scope="col" className="w-48 px-3 font-normal">Last active</th>
              <th scope="col" className="w-36 px-3 font-normal">Joined</th>
              <th scope="col" className="w-16 rounded-r-lg px-3 font-normal"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}:${r.id}`} className="h-17 border-b border-border text-copy text-text-body last:border-b-0">
                <td className="px-4"><Person row={r} /></td>
                <td className="truncate px-3 text-foreground">{r.staffRoleName}</td>
                <td className="px-3"><StatusPill row={r} /></td>
                <td className="px-3">{r.kind === "member" ? dateTime(r.lastActiveAt) : `Invited by ${r.invitedBy ?? "CLI"}`}</td>
                <td className="px-3">{r.kind === "member" ? date(r.createdAt) : `Expires ${formatDhaka(r.expiresAt, "dd MMM, h:mm a")}`}</td>
                <td className="px-3 text-right">
                  <MemberRowActions row={r} roles={roles} isSelf={r.kind === "member" && r.id === selfId} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="grid gap-3 tablet:grid-cols-2 laptop:hidden">
        {rows.map((r) => (
          <li key={`${r.kind}:${r.id}`} className="flex flex-col gap-3 rounded-lg border border-border p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><Person row={r} /></div>
              <MemberRowActionsSheet row={r} roles={roles} isSelf={r.kind === "member" && r.id === selfId} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-caption text-text-body">
              <StatusPill row={r} />
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-bold text-foreground">{r.staffRoleName}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-caption">
              <div>
                <dt className="text-muted-foreground">{r.kind === "member" ? "Last active" : "Invited by"}</dt>
                <dd className="text-foreground">{r.kind === "member" ? dateTime(r.lastActiveAt) : (r.invitedBy ?? "CLI")}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{r.kind === "member" ? "Joined" : "Expires"}</dt>
                <dd className="text-foreground">{r.kind === "member" ? date(r.createdAt) : formatDhaka(r.expiresAt, "dd MMM, h:mm a")}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
