"use server";

import { updateTag } from "next/cache";
import { inviteExpiry, inviteUrl, newInviteToken, usableInviteWhere } from "@/lib/admin/invites";
import { SUPER_ADMIN_ROLE_ID } from "@/lib/admin/roles";
import { logAudit } from "@/lib/audit";
import { isStaffRole } from "@/lib/auth/permissions";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { sendMail } from "@/lib/mail";
import { limitAuthAttempt } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { inviteIdSchema, inviteMemberSchema } from "@/lib/validations/admin";
import { ActionError, type ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Control Authority → Add Members / Resend / Revoke (users:manage, Super Admin).
 *
 * An invite is an AdminInvite row (sha256 of a random token, single use, 48h) plus
 * an email with the /admin/register?token= link. Only the newest link per email
 * works: creating or resending revokes every earlier pending one. The invitee
 * sets their own password on /admin/register (the PNG's "Set Initial Password"
 * is dropped on purpose). Every change is audited.
 */
export type InviteResult = { email: string; needsUpgrade?: boolean };

export async function createInviteAction(_prev: ActionResult<InviteResult> | null, fd: FormData): Promise<ActionResult<InviteResult>> {
  return runAdminAction(
    "users:manage",
    inviteMemberSchema,
    Object.fromEntries(["firstName", "lastName", "email", "phone", "staffRoleId", "upgrade"].map((k) => [k, fd.get(k) ?? undefined])),
    async (data, actor) => {
      const limited = await limitAuthAttempt("admin-invite-send", actor.id);
      if (limited) throw new ActionError(limited);

      const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { role: true } });
      if (existing && isStaffRole(existing.role)) {
        throw new ActionError("This email already belongs to a team member.", { email: ["Already on the team"] });
      }
      // A customer account: ask first. Accepting the invite promotes that account
      // (orders and addresses stay) and replaces its password.
      if (existing && !data.upgrade) return { email: data.email, needsUpgrade: true };

      const role = await staffRoleOrThrow(data.staffRoleId);
      const { token, tokenHash } = newInviteToken();
      const invite = await prisma.$transaction(async (tx) => {
        await tx.adminInvite.updateMany({ where: { email: data.email, ...usableInviteWhere() }, data: { revokedAt: new Date() } });
        const row = await tx.adminInvite.create({
          data: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName || null,
            phone: data.phone || null,
            role: role.id === SUPER_ADMIN_ROLE_ID ? "ADMIN" : "STAFF",
            staffRoleId: role.id,
            tokenHash,
            invitedById: actor.id,
            expiresAt: inviteExpiry(),
          },
          select: { id: true, email: true },
        });
        await logAudit(
          {
            actorId: actor.id,
            action: existing ? "invite.create.upgrade" : "invite.create",
            entity: "AdminInvite",
            entityId: row.id,
            after: { email: row.email, staffRole: role.name, upgradeCustomer: !!existing },
          },
          tx,
        );
        return row;
      });

      await mailInvite(invite.email, role.name, actor.name, token);
      updateTag(CacheTags.adminMembers);
      return { email: invite.email };
    },
  );
}

/** "Resend": a new token + 48h; the old link stops working at once. */
export async function resendInviteAction(input: unknown): Promise<ActionResult<{ email: string }>> {
  return runAdminAction("users:manage", inviteIdSchema, input, async ({ id }, actor) => {
    const limited = await limitAuthAttempt("admin-invite-send", actor.id);
    if (limited) throw new ActionError(limited);

    const { token, tokenHash } = newInviteToken();
    const result = await prisma.$transaction(async (tx) => {
      const old = await tx.adminInvite.findUnique({
        where: { id },
        select: { email: true, firstName: true, lastName: true, phone: true, role: true, staffRoleId: true, staffRole: { select: { name: true } } },
      });
      // Revoke it only if it's still pending (conditional: a concurrent accept wins).
      const n = await tx.adminInvite.updateMany({ where: { id, ...usableInviteWhere() }, data: { revokedAt: new Date() } });
      if (!old || n.count !== 1) throw new ActionError("This invite was already used, revoked or has expired. Send a new one.");
      await tx.adminInvite.updateMany({ where: { email: old.email, ...usableInviteWhere() }, data: { revokedAt: new Date() } });
      const row = await tx.adminInvite.create({
        data: {
          email: old.email,
          firstName: old.firstName,
          lastName: old.lastName,
          phone: old.phone,
          role: old.role,
          staffRoleId: old.staffRoleId,
          tokenHash,
          invitedById: actor.id,
          expiresAt: inviteExpiry(),
        },
        select: { id: true },
      });
      await logAudit(
        { actorId: actor.id, action: "invite.resend", entity: "AdminInvite", entityId: row.id, before: { inviteId: id }, after: { inviteId: row.id, email: old.email } },
        tx,
      );
      return { email: old.email, roleName: old.staffRole?.name ?? (old.role === "ADMIN" ? "Super Admin" : "Staff") };
    });

    await mailInvite(result.email, result.roleName, actor.name, token);
    updateTag(CacheTags.adminMembers);
    return { email: result.email };
  });
}

export async function revokeInviteAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction("users:manage", inviteIdSchema, input, async ({ id }, actor) => {
    await prisma.$transaction(async (tx) => {
      const n = await tx.adminInvite.updateMany({ where: { id, ...usableInviteWhere() }, data: { revokedAt: new Date() } });
      if (n.count !== 1) throw new ActionError("This invite was already used, revoked or has expired.");
      await logAudit({ actorId: actor.id, action: "invite.revoke", entity: "AdminInvite", entityId: id }, tx);
    });
    updateTag(CacheTags.adminMembers);
  });
}

async function staffRoleOrThrow(id: string, db: Pick<Prisma.TransactionClient, "staffRole"> = prisma) {
  const role = await db.staffRole.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!role) throw new ActionError("That role no longer exists.", { staffRoleId: ["Choose a role"] });
  return role;
}

async function mailInvite(email: string, roleName: string, inviter: string, token: string) {
  const link = inviteUrl(token, siteUrl.origin);
  await sendMail({
    to: email,
    subject: `You're invited to the {store} admin as ${roleName}`,
    text: `${inviter} invited you to the {store} admin as ${roleName}. Create your password within 48 hours: ${link}`,
    link,
  });
}
