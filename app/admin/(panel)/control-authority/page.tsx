import type { Metadata } from "next";
import { ChevronRightIcon, CirclePlusIcon, SearchIcon } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { Suspense } from "react";
import { AddMemberSheet } from "@/components/admin/control-authority/add-member-sheet";
import { AssistanceIllustration } from "@/components/admin/control-authority/assistance-illustration";
import { MembersTable, initials } from "@/components/admin/control-authority/members-table";
import { MembersToolbar } from "@/components/admin/control-authority/members-toolbar";
import { PermissionMatrix } from "@/components/admin/control-authority/permission-matrix";
import { RoleIcon } from "@/components/admin/control-authority/role-icon";
import { RoleSheet } from "@/components/admin/control-authority/role-sheet";
import { Forbidden } from "@/components/admin/shell/forbidden";
import { Container } from "@/components/shared/container";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { parseTeamParams, teamHref, type TeamParams } from "@/lib/admin/team/params";
import { can } from "@/lib/auth/permissions";
import { requireStaff, type CurrentUser } from "@/lib/auth-guards";
import { getRoleMembers, getStaffRoles, getTeamMembers, type TeamRole } from "@/lib/queries/admin/team";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Control Authority" };

/**
 * Control Authority (Add Members.png / Create New Role.png, users:manage).
 * Laptop+ = the PNG: "Role Management" header (Search Role · Create New Role);
 * System Roles list + "Need assistance?" card | Members of the selected role +
 * Permissions table. Added under it: All members (table / cards) with pending
 * invites. URL state: lib/admin/team/params.ts.
 */
export default function ControlAuthorityPage({ searchParams }: PageProps<"/admin/control-authority">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Gate searchParams={searchParams} />
    </Suspense>
  );
}

async function Gate({ searchParams }: Pick<PageProps<"/admin/control-authority">, "searchParams">) {
  const user = await requireStaff("/admin/control-authority");
  if (!can(user, "users:manage")) return <Forbidden />;
  const params = parseTeamParams(await searchParams);
  const roles = await getStaffRoles();
  const visibleRoles = params.rq ? roles.filter((r) => r.name.toLowerCase().includes(params.rq.toLowerCase())) : roles;
  const selected = roles.find((r) => r.id === params.role) ?? visibleRoles[0] ?? roles[0]!;
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));
  const editId = params.modal?.kind === "edit" ? params.modal.id : null;
  const editing = editId ? (roles.find((r) => r.id === editId && !r.isSystem) ?? null) : null;

  return (
    <Container variant="admin" className="flex flex-col gap-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-h1 text-foreground">Role Management</h2>
        <div className="flex w-full flex-wrap items-center gap-3 tablet:w-auto">
          <Form action="/admin/control-authority" replace scroll={false} className="relative min-w-0 flex-1 tablet:w-78.75 tablet:flex-none">
            {params.role && <input type="hidden" name="role" value={params.role} />}
            <label htmlFor="role-search" className="sr-only">
              Search roles
            </label>
            <input
              id="role-search"
              name="rq"
              type="search"
              defaultValue={params.rq}
              placeholder="Search Role"
              autoComplete="off"
              className="h-12 w-full rounded-lg border border-border bg-card pr-11 pl-3 text-lead text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/30 [&::-webkit-search-cancel-button]:hidden"
            />
            <button type="submit" aria-label="Search" className="tap-target absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center text-foreground">
              <SearchIcon aria-hidden className="size-6 stroke-[1.5]" />
            </button>
          </Form>
          <Link
            href={teamHref(params, { modal: { kind: "new" } })}
            scroll={false}
            className="press tap-target inline-flex h-12 shrink-0 items-center gap-1 rounded-lg bg-primary px-3 text-lead font-bold text-primary-foreground hover:bg-primary-hover"
          >
            <CirclePlusIcon aria-hidden className="size-6" /> Create New Role
          </Link>
        </div>
      </div>

      <div className="grid gap-5 laptop:grid-cols-[23.5rem_minmax(0,1fr)] laptop:grid-rows-[auto_1fr]">
        <RoleList params={params} roles={visibleRoles} selectedId={selected.id} />

        <section aria-labelledby="role-members-title" className="flex min-w-0 flex-col gap-5 rounded-xl bg-card p-4 tablet:px-6 tablet:py-4 laptop:row-span-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id="role-members-title" className="mr-auto text-h2 text-foreground">
                Members <span className="sr-only">with the {selected.name} role</span>
              </h3>
              <Link
                href={`${teamHref(params, { role: selected.id, mrole: selected.id, status: "all" })}#all-members`}
                scroll={false}
                className="tap-target inline-flex h-7.25 items-center rounded-md px-2 text-copy text-primary hover:bg-secondary"
              >
                See more
              </Link>
              <AddMemberSheet roles={roleOptions} defaultRoleId={selected.id} variant="card" />
            </div>
            <Suspense key={selected.id} fallback={<ChipsSkeleton />}>
              <RoleMembers roleId={selected.id} roleName={selected.name} />
            </Suspense>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="mr-auto text-h2 text-foreground">Permissions</h3>
              {!selected.isSystem && (
                <Link
                  href={teamHref(params, { role: selected.id, modal: { kind: "edit", id: selected.id } })}
                  scroll={false}
                  className="tap-target inline-flex h-8 items-center rounded-md px-2 text-copy text-primary hover:bg-secondary"
                >
                  Edit role
                </Link>
              )}
            </div>
            <PermissionMatrix role={selected} />
          </div>
        </section>

        <section aria-labelledby="assist-title" className="flex flex-col gap-5 rounded-xl bg-primary p-6 text-primary-foreground">
          <div className="flex flex-col gap-2">
            <h3 id="assist-title" className="text-h2">
              Need assistance?
            </h3>
            <p className="text-copy">
              You are currently managing the ‘{selected.name}’ role. Changes here will affect all users with this permission profile
            </p>
          </div>
          <AssistanceIllustration className="mx-auto h-39 w-auto max-w-full" />
          <Link
            href="/admin/control-authority/logs"
            className="press tap-target inline-flex h-8.5 items-center justify-center rounded-lg border border-primary-foreground text-copy font-bold hover:bg-primary-foreground/10"
          >
            View Security Logs
          </Link>
        </section>
      </div>

      <section id="all-members" aria-labelledby="all-members-title" className="flex scroll-mt-24 flex-col gap-4 rounded-xl bg-card p-4 tablet:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h3 id="all-members-title" className="mr-auto text-h2 text-foreground">
            All members
          </h3>
          <AddMemberSheet roles={roleOptions} />
        </div>
        <MembersToolbar params={params} roles={roleOptions} />
        <Suspense key={`${params.q}|${params.mrole}|${params.status}`} fallback={<RowsSkeleton />}>
          <AllMembers params={params} roles={roleOptions} user={user} />
        </Suspense>
      </section>

      <RoleSheet params={params} editing={editing} />
    </Container>
  );
}

function RoleList({ params, roles, selectedId }: { params: TeamParams; roles: TeamRole[]; selectedId: string }) {
  return (
    <section aria-labelledby="roles-title" className="flex flex-col gap-4 rounded-xl bg-card px-4 pt-4 pb-4">
      <h3 id="roles-title" className="px-2 text-h2 text-foreground">
        System Roles
      </h3>
      {roles.length === 0 ? (
        <p className="px-2 text-copy text-muted-foreground">No role matches “{params.rq}”.</p>
      ) : (
        <ul className="flex flex-col gap-5">
          {roles.map((r) => {
            const active = r.id === selectedId;
            return (
              <li key={r.id}>
                <Link
                  href={teamHref(params, { role: r.id })}
                  replace
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "press flex h-15.5 items-center gap-2 rounded-r-lg border-l-4 p-2 pr-4 transition-colors",
                    active ? "border-primary bg-secondary" : "border-transparent hover:bg-muted",
                  )}
                >
                  <span className={cn("grid size-11.5 shrink-0 place-items-center rounded-full", active ? "bg-primary text-primary-foreground" : "bg-muted text-text-body")}>
                    <RoleIcon icon={r.icon} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-lead text-foreground">{r.name}</span>
                    <span className="text-copy text-muted-foreground">
                      {r.activeUsers} active user{r.activeUsers === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ChevronRightIcon aria-hidden className="size-4 shrink-0 self-end text-primary" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

async function RoleMembers({ roleId, roleName }: { roleId: string; roleName: string }) {
  const members = await getRoleMembers(roleId);
  if (members.length === 0) return <p className="rounded-lg bg-muted px-4 py-3 text-copy text-muted-foreground">No one has the {roleName} role yet.</p>;
  return (
    <ul className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
      {members.slice(0, 6).map((m) => (
        <li key={m.id} className="flex h-12.25 items-center gap-3 rounded-lg border border-border px-4">
          <Avatar className="size-8 shrink-0">
            {m.image && <AvatarImage src={m.image} alt="" />}
            <AvatarFallback className="bg-secondary text-caption font-bold text-primary">{initials(m.name)}</AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-copy text-foreground">{m.name}</span>
            <span className="truncate text-caption text-muted-foreground">{m.email}</span>
          </span>
          <span
            role="img"
            aria-label={m.deactivatedAt ? "Deactivated" : "Active"}
            className={cn("size-3 shrink-0 rounded-full", m.deactivatedAt ? "bg-muted-strong" : "bg-primary")}
          />
        </li>
      ))}
    </ul>
  );
}

async function AllMembers({ params, roles, user }: { params: TeamParams; roles: { id: string; name: string }[]; user: CurrentUser }) {
  const { members, invites } = await getTeamMembers({ q: params.q, staffRoleId: params.mrole, status: params.status });
  return <MembersTable rows={[...invites, ...members]} roles={roles} selfId={user.id} />;
}

function ChipsSkeleton() {
  return (
    <div className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-12.25 rounded-lg" />
      ))}
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-17 rounded-lg" />
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <Container variant="admin" className="flex flex-col gap-5 py-5">
      <Skeleton className="h-12 w-60" />
      <div className="grid gap-5 laptop:grid-cols-[23.5rem_minmax(0,1fr)]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-150 rounded-xl" />
      </div>
    </Container>
  );
}
