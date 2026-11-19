/**
 * Control Authority member changes: the rules, enforced inside the caller's
 * transaction. No server-only (scripts/check-team.ts runs them against the DB).
 *
 * - Nobody changes their own role, deactivates or removes themselves.
 * - The last active Super Admin (User.role ADMIN) can't be demoted, deactivated
 *   or removed. The active ADMIN rows are locked FOR UPDATE first, so two admins
 *   demoting each other at once can't both pass.
 * - Every change deletes the member's sessions: a deactivated or removed member
 *   is out at once, a role change re-reads permissions on the next sign-in.
 * - Remove is soft: role → CUSTOMER and the role link cleared; the User row stays,
 *   so audit entries, order history and refunds stay attributed.
 */
import { ActionError } from "@/lib/actions/result";
import { userRoleFor } from "@/lib/admin/roles";
import type { Prisma } from "@/lib/generated/prisma/client";

type Tx = Prisma.TransactionClient;

export type MemberSnapshot = { role: string; staffRole: string | null; active: boolean };
export type MemberChange = { userId: string; email: string; before: MemberSnapshot; after: MemberSnapshot };

const SELF = "You can't change your own access. Ask another Super Admin.";
const LAST_ADMIN = "This is the last active Super Admin. Make someone else a Super Admin first.";

async function loadTarget(tx: Tx, actorId: string, userId: string) {
  if (userId === actorId) throw new ActionError(SELF);
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, deactivatedAt: true, staffRole: { select: { name: true } } },
  });
  if (!user || (user.role !== "STAFF" && user.role !== "ADMIN")) throw new ActionError("This team member no longer exists.");
  return user;
}

const snapshot = (u: { role: string; deactivatedAt: Date | null; staffRole: { name: string } | null }): MemberSnapshot => ({
  role: u.role,
  staffRole: u.staffRole?.name ?? null,
  active: !u.deactivatedAt,
});

/** Throws if `userId` is the only active ADMIN. Locks the active ADMIN rows. */
async function assertNotLastAdmin(tx: Tx, userId: string) {
  const admins = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "deactivatedAt" IS NULL FOR UPDATE`;
  if (admins.some((a) => a.id === userId) && admins.length <= 1) throw new ActionError(LAST_ADMIN);
}

export async function changeMemberRole(tx: Tx, actorId: string, userId: string, staffRoleId: string): Promise<MemberChange> {
  const user = await loadTarget(tx, actorId, userId);
  const role = await tx.staffRole.findUnique({ where: { id: staffRoleId }, select: { id: true, name: true } });
  if (!role) throw new ActionError("That role no longer exists.");
  const nextRole = userRoleFor(role.id);
  if (user.role === "ADMIN" && nextRole !== "ADMIN") await assertNotLastAdmin(tx, userId);

  await tx.user.update({ where: { id: userId }, data: { role: nextRole, staffRoleId: role.id } });
  await tx.session.deleteMany({ where: { userId } });
  return { userId, email: user.email, before: snapshot(user), after: { role: nextRole, staffRole: role.name, active: !user.deactivatedAt } };
}

export async function setMemberActive(tx: Tx, actorId: string, userId: string, active: boolean): Promise<MemberChange> {
  const user = await loadTarget(tx, actorId, userId);
  if (!active && user.role === "ADMIN") await assertNotLastAdmin(tx, userId);

  await tx.user.update({ where: { id: userId }, data: { deactivatedAt: active ? null : new Date() } });
  if (!active) await tx.session.deleteMany({ where: { userId } });
  return { userId, email: user.email, before: snapshot(user), after: { ...snapshot(user), active } };
}

export async function removeMember(tx: Tx, actorId: string, userId: string): Promise<MemberChange> {
  const user = await loadTarget(tx, actorId, userId);
  if (user.role === "ADMIN") await assertNotLastAdmin(tx, userId);

  await tx.user.update({ where: { id: userId }, data: { role: "CUSTOMER", staffRoleId: null, deactivatedAt: null } });
  await tx.session.deleteMany({ where: { userId } });
  return { userId, email: user.email, before: snapshot(user), after: { role: "CUSTOMER", staffRole: null, active: true } };
}
