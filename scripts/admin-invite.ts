/**
 * pnpm admin:invite <email> <STAFF|ADMIN> [--first Name] [--last Name]
 *
 * Creates an admin invite (48h, single use) and prints the /admin/register link.
 * For dev / ops; the UI equivalent is Control Authority → Add Members. Audited.
 */
import { inviteExpiry, inviteUrl, newInviteToken } from "../lib/admin/invites";
import { flags, prisma } from "./lib-db";

async function main() {
  const [rawEmail, rawRole] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const f = flags();
  const email = rawEmail?.trim().toLowerCase();
  const role = rawRole?.toUpperCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (role !== "STAFF" && role !== "ADMIN")) {
    console.error("Usage: pnpm admin:invite <email> <STAFF|ADMIN> [--first Name] [--last Name]");
    process.exitCode = 1;
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { role: true } });
  if (existing && existing.role !== "CUSTOMER") throw new Error(`${email} is already ${existing.role}.`);

  const { token, tokenHash } = newInviteToken();
  await prisma.$transaction(async (tx) => {
    await tx.adminInvite.updateMany({
      where: { email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { revokedAt: new Date() },
    });
    const invite = await tx.adminInvite.create({
      data: { email, role, firstName: f.first || email.split("@")[0]!, lastName: f.last || null, tokenHash, expiresAt: inviteExpiry() },
    });
    await tx.auditLog.create({
      data: { actorId: null, action: "invite.create", entity: "AdminInvite", entityId: invite.id, after: { email, role, via: "cli" } },
    });
  });
  const origin = process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  console.log(`✔ Invite for ${email} (${role}), valid 48 hours:\n  ${inviteUrl(token, origin)}`);
}

main()
  .catch((err) => {
    console.error(`✖ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
