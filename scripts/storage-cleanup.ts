/**
 * pnpm storage:cleanup [--hours 24]
 * Deletes tmp/ uploads older than --hours (default 24) from this branch's bucket,
 * with their unattached Media rows. Same job as /api/cron/media-cleanup.
 */
import { cleanupTmpUploads } from "../lib/media/cleanup";
import { neonStorage } from "../lib/storage/core";
import { flags, prisma } from "./lib-db";

const hours = Number(flags().hours ?? 24);
if (!Number.isFinite(hours) || hours < 0) throw new Error("--hours must be a number ≥ 0");

cleanupTmpUploads(prisma, neonStorage, hours)
  .then((r) => console.log(`tmp cleanup (>${hours}h): deleted ${r.deleted}, kept ${r.kept} still in use`))
  .finally(() => prisma.$disconnect());
