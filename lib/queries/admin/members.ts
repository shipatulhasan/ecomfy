import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";

/**
 * Control Authority: staff members and pending invites. Callers check
 * `users:manage` first (no session is read in here). Invite actions updateTag() it.
 */
export async function getAdminMembers() {
  "use cache";
  cacheTag(CacheTags.adminMembers);
  cacheLife("minutes");

  const now = new Date();
  const [members, invites] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["STAFF", "ADMIN"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, role: true, image: true, createdAt: true },
    }),
    prisma.adminInvite.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: { select: { name: true } },
      },
    }),
  ]);
  return { members, invites };
}
