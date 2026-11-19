import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cronSecret } from "@/lib/env";

/** `Authorization: Bearer $CRON_SECRET` (constant-time). Cron is off when CRON_SECRET is unset. */
export function authorizeCron(request: Request): boolean {
  const secret = cronSecret();
  if (secret === null) return false;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
