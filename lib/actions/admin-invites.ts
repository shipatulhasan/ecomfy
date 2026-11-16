"use server";

import { updateTag } from "next/cache";
import { inviteExpiry, inviteUrl, newInviteToken, usableInviteWhere } from "@/lib/admin/invites";
import { logAudit } from "@/lib/audit";
import { isStaffRole, ROLE_LABELS } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { siteUrl } from "@/lib/site-url";
import { inviteIdSchema, inviteMemberSchema } from "@/lib/validations/admin";
import { CacheTags } from "@/lib/cache-tags";
import { ActionError, type ActionResult } from "./result";
import { runAdminAction } from "./safe-action";

/**
 * Control Authority → Add Members (users:manage). Creates an AdminInvite and emails
 * the single-use /admin/register link (48h). Any earlier pending invite for the
 * same email is revoked, so only the newest link works. Audited.
 */
export async function createInviteAction(
  _prev: ActionResult<{ email: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ email: string }>> {
  return runAdminAction(
    "users:manage",
    inviteMemberSchema,
    Object.fromEntries(["firstName", "lastName", "email", "phone", "role"].map((k) => [k, fd.get(k) ?? undefined])),
    async (data, actor) => {

      const existing = await prisma.user.findUnique({ where: { email: data.email }, select: { role: true } });
      if (existing && isStaffRole(existing.role)) throw new ActionError("This email already belongs to a staff member.");

      const { token, tokenHash } = newInviteToken();
      const invite = await prisma.$transaction(async (tx) => {
        await tx.adminInvite.updateMany({
          where: { email: data.email, ...usableInviteWhere() },
          data: { revokedAt: new Date() },
        });
        const row = await tx.adminInvite.create({
          data: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName || null,
            phone: data.phone || null,
            role: data.role,
            tokenHash,
            invitedById: actor.id,
            expiresAt: inviteExpiry(),
          },
          select: { id: true, email: true, role: true, expiresAt: true },
        });
        await logAudit(
          { actorId: actor.id, action: "invite.create", entity: "AdminInvite", entityId: row.id, after: { email: row.email, role: row.role } },
          tx,
        );
        return row;
      });

      const link = inviteUrl(token, siteUrl.origin);
      await sendMail({
        to: invite.email,
        subject: `You're invited to the Ecofy admin as ${ROLE_LABELS[invite.role]}`,
        text: `${actor.name} invited you to the Ecofy admin. Create your account within 48 hours: ${link}`,
        link,
      });
      updateTag(CacheTags.adminMembers);
      return { email: invite.email };
    },
  );
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
