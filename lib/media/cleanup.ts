import type { PrismaClient } from "@/lib/generated/prisma/client";
import type { Storage } from "@/lib/storage/core";

/**
 * Deletes abandoned product-form uploads: objects under tmp/ older than
 * `maxAgeHours` (default 24) and their Media rows, unless a product still uses
 * the row (a save moves tmp files into products/{id}/ or categories/{id}/, so that only happens if
 * a move failed). No "server-only": the cron route and `pnpm storage:cleanup`
 * both call it with their own clients.
 */
export async function cleanupTmpUploads(db: PrismaClient, store: Storage, maxAgeHours = 24): Promise<{ deleted: number; kept: number }> {
  const cutoff = Date.now() - maxAgeHours * 3_600_000;
  const stale: string[] = [];
  for await (const o of store.list("tmp/")) {
    if (!o.lastModified || o.lastModified.getTime() <= cutoff) stale.push(o.key);
  }
  if (stale.length === 0) return { deleted: 0, kept: 0 };

  const used = await db.media.findMany({
    where: { key: { in: stale }, OR: [{ productImages: { some: {} } }, { categoryImages: { some: {} } }] },
    select: { key: true },
  });
  const keep = new Set(used.map((u) => u.key));
  const doomed = stale.filter((k) => !keep.has(k));

  await db.media.deleteMany({ where: { key: { in: doomed }, productImages: { none: {} }, categoryImages: { none: {} } } });
  await store.delete(doomed);
  return { deleted: doomed.length, kept: keep.size };
}
