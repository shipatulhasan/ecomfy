import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * Admin invites (AdminInvite): a 32-byte random token goes out in the link, only
 * its sha256 is stored. 48h, single use (acceptedAt), revocable (revokedAt).
 * Shared by the server actions, the seed and the CLI scripts (they pass their own
 * client), so no `server-only` here; it only uses node:crypto.
 */
export const INVITE_TTL_HOURS = 48;

export function newInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteUrl(token: string, origin: string) {
  return `${origin.replace(/\/$/, "")}/admin/register?token=${encodeURIComponent(token)}`;
}

export const inviteExpiry = (from = new Date()) => new Date(from.getTime() + INVITE_TTL_HOURS * 3_600_000);

/** Not accepted, not revoked, not expired. */
export const usableInviteWhere = (now = new Date()) => ({
  acceptedAt: null,
  revokedAt: null,
  expiresAt: { gt: now },
});

/** The invite a token opens, or null when it is unknown / used / revoked / expired. */
export async function findUsableInvite(db: Pick<PrismaClient, "adminInvite">, token: string | null | undefined) {
  if (!token || token.length < 16 || token.length > 128) return null;
  return db.adminInvite.findFirst({
    where: { tokenHash: hashInviteToken(token), ...usableInviteWhere() },
    select: { id: true, email: true, firstName: true, lastName: true, phone: true, role: true, expiresAt: true },
  });
}
