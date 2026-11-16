import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { cronSecret } from "@/lib/env";
import { cleanupTmpUploads } from "@/lib/media/cleanup";
import { storage } from "@/lib/storage";

/**
 * Deletes product-form uploads abandoned in tmp/ for more than 24h (and their
 * unattached Media rows). Scheduled daily by vercel.json; call with
 * `Authorization: Bearer $CRON_SECRET`. Locally: `pnpm storage:cleanup`.
 */
export async function GET(request: Request) {
  await connection();
  const secret = cronSecret();
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const ok =
    secret !== null && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return new Response("Unauthorized", { status: 401 });

  return Response.json(await cleanupTmpUploads(prisma, storage));
}
