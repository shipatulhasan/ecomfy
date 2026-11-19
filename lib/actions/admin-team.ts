"use server";

import { updateTag } from "next/cache";
import { SUPER_ADMIN_ROLE_ID } from "@/lib/admin/roles";
import { changeMemberRole, removeMember, setMemberActive, type MemberChange } from "@/lib/admin/team-rules";
import { logAudit } from "@/lib/audit";
import { withImpliedReads, type Permission } from "@/lib/auth/permissions";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import {
  memberActiveSchema,
  memberIdSchema,
  memberRoleSchema,
  roleFormSchema,
  roleIdSchema,
  rolePermissionsSchema,
} from "@/lib/validations/admin-team";
import { ActionError, type ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Control Authority (users:manage = Super Admin only): roles, their permission
 * matrix, and member role / active / remove. Member rules live in
 * lib/admin/team-rules.ts (self, last Super Admin, session revocation). Every
 * change is audited with before/after and expires the `admin-members` tag.
 */

const SUPER_ADMIN_LOCKED = "The Super Admin role always has every permission and can't be changed.";

// ───────────────────────────── roles ─────────────────────────────

export async function saveRoleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction("users:manage", roleFormSchema, input, async (data, actor) => {
    if (data.id === SUPER_ADMIN_ROLE_ID) throw new ActionError(SUPER_ADMIN_LOCKED);
    try {
      const id = await prisma.$transaction(async (tx) => {
        const fields = { name: data.name, description: data.description || null, icon: data.icon };
        if (data.id) {
          const before = await tx.staffRole.findUnique({ where: { id: data.id }, select: { name: true, description: true, icon: true } });
          if (!before) throw new ActionError("This role no longer exists.");
          await tx.staffRole.update({ where: { id: data.id }, data: fields });
          await logAudit({ actorId: actor.id, action: "role.update", entity: "StaffRole", entityId: data.id, before, after: fields }, tx);
          return data.id;
        }
        const last = await tx.staffRole.aggregate({ _max: { sortOrder: true } });
        const row = await tx.staffRole.create({
          data: { ...fields, permissions: withImpliedReads((data.permissions ?? ["dashboard:read"]) as Permission[]), sortOrder: (last._max.sortOrder ?? 0) + 1 },
          select: { id: true },
        });
        await logAudit({ actorId: actor.id, action: "role.create", entity: "StaffRole", entityId: row.id, after: { ...fields, permissions: data.permissions ?? [] } }, tx);
        return row.id;
      });
      updateTag(CacheTags.adminMembers);
      return { id };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ActionError("A role with this name already exists.", { name: ["Already used"] });
      }
      throw err;
    }
  });
}

/**
 * Permissions table → Save. Write permissions pull in their module's View.
 * Members of the role get the change on their next request (getCurrentUser
 * re-reads the role every request).
 */
export async function saveRolePermissionsAction(input: unknown): Promise<ActionResult<{ permissions: Permission[] }>> {
  return runAdminAction("users:manage", rolePermissionsSchema, input, async ({ id, permissions }, actor) => {
    if (id === SUPER_ADMIN_ROLE_ID) throw new ActionError(SUPER_ADMIN_LOCKED);
    const next = withImpliedReads(permissions as Permission[]);
    await prisma.$transaction(async (tx) => {
      const before = await tx.staffRole.findUnique({ where: { id }, select: { permissions: true } });
      if (!before) throw new ActionError("This role no longer exists.");
      await tx.staffRole.update({ where: { id }, data: { permissions: next } });
      const added = next.filter((p) => !before.permissions.includes(p));
      const removed = before.permissions.filter((p) => !(next as string[]).includes(p));
      await logAudit(
        { actorId: actor.id, action: "role.permissions", entity: "StaffRole", entityId: id, before: { permissions: before.permissions }, after: { permissions: next, added, removed } },
        tx,
      );
    });
    updateTag(CacheTags.adminMembers);
    return { permissions: next };
  });
}

/** Only a custom role with no members and no pending invites. */
export async function deleteRoleAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction("users:manage", roleIdSchema, input, async ({ id }, actor) => {
    await prisma.$transaction(async (tx) => {
      const role = await tx.staffRole.findUnique({
        where: { id },
        select: { name: true, isSystem: true, permissions: true, _count: { select: { users: { where: { role: { in: ["STAFF", "ADMIN"] } } } } } },
      });
      if (!role) throw new ActionError("This role no longer exists.");
      if (role.isSystem) throw new ActionError(SUPER_ADMIN_LOCKED);
      if (role._count.users > 0) throw new ActionError(`Move the ${role._count.users} member(s) with this role to another role first.`);
      await tx.adminInvite.updateMany({ where: { staffRoleId: id, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
      // Removed (ex-staff) users may still point at it.
      await tx.user.updateMany({ where: { staffRoleId: id }, data: { staffRoleId: null } });
      await tx.staffRole.delete({ where: { id } });
      await logAudit({ actorId: actor.id, action: "role.delete", entity: "StaffRole", entityId: id, before: { name: role.name, permissions: role.permissions } }, tx);
    });
    updateTag(CacheTags.adminMembers);
  });
}

// ───────────────────────────── members ─────────────────────────────

async function memberChange(actorId: string, action: string, run: (tx: Prisma.TransactionClient) => Promise<MemberChange>) {
  const change = await prisma.$transaction(async (tx) => {
    const c = await run(tx);
    await logAudit({ actorId, action, entity: "User", entityId: c.userId, before: c.before, after: { ...c.after, email: c.email } }, tx);
    return c;
  });
  updateTag(CacheTags.adminMembers);
  return { userId: change.userId };
}

export async function changeMemberRoleAction(input: unknown): Promise<ActionResult<{ userId: string }>> {
  return runAdminAction("users:manage", memberRoleSchema, input, ({ userId, staffRoleId }, actor) =>
    memberChange(actor.id, "member.role", (tx) => changeMemberRole(tx, actor.id, userId, staffRoleId)),
  );
}

/** Deactivate: can't sign in (Better Auth session hook) and every session is deleted now. */
export async function setMemberActiveAction(input: unknown): Promise<ActionResult<{ userId: string }>> {
  return runAdminAction("users:manage", memberActiveSchema, input, ({ userId, active }, actor) =>
    memberChange(actor.id, active ? "member.reactivate" : "member.deactivate", (tx) => setMemberActive(tx, actor.id, userId, active)),
  );
}

export async function removeMemberAction(input: unknown): Promise<ActionResult<{ userId: string }>> {
  return runAdminAction("users:manage", memberIdSchema, input, ({ userId }, actor) =>
    memberChange(actor.id, "member.remove", (tx) => removeMember(tx, actor.id, userId)),
  );
}
