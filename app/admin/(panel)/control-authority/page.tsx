import type { Metadata } from "next";
import { Suspense } from "react";
import { AddMemberSheet } from "@/components/admin/control-authority/add-member-sheet";
import { RevokeInviteButton } from "@/components/admin/control-authority/revoke-invite-button";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { requireStaff } from "@/lib/auth-guards";
import { formatDhaka } from "@/lib/admin/date-range";
import { getAdminMembers } from "@/lib/queries/admin/members";

export const metadata: Metadata = { title: "Control Authority" };

/**
 * Control Authority (base frame has no PNG): for now the members list, pending
 * invites and the "Add Members" drawer (Add Members.png). Roles / permission matrix
 * come with the full screen.
 */
export default function ControlAuthorityPage() {
  return (
    <Suspense fallback={<MembersSkeleton />}>
      <Gate />
    </Suspense>
  );
}

async function Gate() {
  const user = await requireStaff("/admin/control-authority");
  if (!can(user, "users:manage")) return <Forbidden />;
  const { members, invites } = await getAdminMembers();

  return (
    <Container variant="admin" className="flex flex-col gap-section py-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h1 text-foreground">Members</h2>
        <AddMemberSheet />
      </div>

      <section aria-labelledby="members-title" className="rounded-xl bg-card p-6">
        <h3 id="members-title" className="text-h3 text-foreground">
          Staff &amp; admins <span className="text-muted-foreground">({members.length})</span>
        </h3>
        <ul className="mt-4 grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Avatar className="size-11">
                {m.image && <AvatarImage src={m.image} alt="" />}
                <AvatarFallback className="bg-secondary text-copy font-bold text-primary">{initials(m.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-copy font-bold text-foreground">{m.name}</p>
                <p className="truncate text-caption text-muted-foreground">{m.email}</p>
              </div>
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-caption font-bold text-secondary-foreground">
                {ROLE_LABELS[m.role]}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="invites-title" className="rounded-xl bg-card p-6">
        <h3 id="invites-title" className="text-h3 text-foreground">
          Pending invites <span className="text-muted-foreground">({invites.length})</span>
        </h3>
        {invites.length === 0 ? (
          <p className="mt-4 text-copy text-muted-foreground">No pending invites.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {invites.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-copy font-bold text-foreground">
                    {[i.firstName, i.lastName].filter(Boolean).join(" ")} · {i.email}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {ROLE_LABELS[i.role]} · invited by {i.invitedBy?.name ?? "CLI"} · expires {formatDhaka(i.expiresAt, "dd MMM, h:mm a")}
                  </p>
                </div>
                <RevokeInviteButton id={i.id} email={i.email} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Container>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function MembersSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-section py-section">
      <Skeleton className="h-11 w-60" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </Container>
  );
}
