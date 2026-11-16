import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { clientIp } from "@/lib/rate-limit";

/**
 * Audit trail for the admin. **Every admin mutation calls logAudit()**, passing the
 * transaction client when the change runs in one, so the log commits with it.
 * Never put secrets (passwords, tokens) in before/after.
 */
export type AuditEntry = {
  actorId: string | null;
  action: string; // "invite.create"
  entity: string; // "AdminInvite"
  entityId?: string | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
};

type Db = Pick<Prisma.TransactionClient, "auditLog">;

export async function logAudit(entry: AuditEntry, db: Db = prisma): Promise<void> {
  let ip: string | null = null;
  let userAgent: string | null = null;
  try {
    ip = await clientIp();
    userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  } catch {
    // Outside a request (CLI scripts): no ip / user agent.
  }
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: entry.before ?? undefined,
      after: entry.after ?? undefined,
      ip,
      userAgent,
    },
  });
}
