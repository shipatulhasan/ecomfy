import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * Fixed-window rate limiting in Postgres (RateLimitBucket). One atomic upsert per
 * check, so concurrent requests can't all slip past a stale read.
 *
 * Used twice:
 * - as Better Auth's `rateLimit.customStorage` (HTTP endpoints under /api/auth,
 *   e.g. the Google callback), keyed by IP + path;
 * - directly by the auth server actions (`limitAuthAttempt`), which call
 *   `auth.api.*` in-process and so bypass Better Auth's HTTP limiter. Those are
 *   keyed per IP + email and per IP.
 */
export type Rule = { window: number; max: number }; // window in seconds

export async function consume(key: string, rule: Rule): Promise<{ allowed: boolean; retryAfter: number | null }> {
  const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${rule.window}))
    ON CONFLICT ("key") DO UPDATE SET
      "count"   = CASE WHEN "RateLimitBucket"."resetAt" <= now() THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= now()
                    THEN now() + make_interval(secs => ${rule.window})
                    ELSE "RateLimitBucket"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0]!;
  if (row.count <= rule.max) return { allowed: true, retryAfter: null };
  return { allowed: false, retryAfter: Math.max(1, Math.ceil((row.resetAt.getTime() - Date.now()) / 1000)) };
}

/** Best-effort client IP (behind Vercel / a proxy: the first x-forwarded-for hop). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export type AuthAction = "sign-in" | "sign-up" | "reset" | "verify";

/** Per IP + email, and per IP overall (stops one IP spraying many emails). */
const limits: Record<AuthAction, { perEmail: Rule; perIp: Rule }> = {
  "sign-in": { perEmail: { window: 15 * 60, max: 5 }, perIp: { window: 15 * 60, max: 30 } },
  "sign-up": { perEmail: { window: 60 * 60, max: 3 }, perIp: { window: 60 * 60, max: 10 } },
  reset: { perEmail: { window: 60 * 60, max: 3 }, perIp: { window: 60 * 60, max: 10 } },
  verify: { perEmail: { window: 60 * 60, max: 3 }, perIp: { window: 60 * 60, max: 10 } },
};

/**
 * Returns null when allowed, or a user-facing message. The message is the same
 * whether or not the email has an account.
 */
export async function limitAuthAttempt(action: AuthAction, email: string): Promise<string | null> {
  const ip = await clientIp();
  const rule = limits[action];
  const [byEmail, byIp] = await Promise.all([
    consume(`${action}:ip-email:${ip}:${email.trim().toLowerCase()}`, rule.perEmail),
    consume(`${action}:ip:${ip}`, rule.perIp),
  ]);
  const blocked = [byEmail, byIp].filter((r) => !r.allowed);
  if (blocked.length === 0) return null;
  const seconds = Math.max(...blocked.map((r) => r.retryAfter ?? 60));
  const minutes = Math.ceil(seconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

/** After a successful sign-in, forget that IP + email's failures (the per-IP bucket stays). */
export async function clearAuthAttempts(action: AuthAction, email: string) {
  const ip = await clientIp();
  await prisma.rateLimitBucket.deleteMany({ where: { key: `${action}:ip-email:${ip}:${email.trim().toLowerCase()}` } });
}

/** Drop expired buckets now and then (called opportunistically, never awaited by users). */
export async function pruneRateLimits() {
  await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } });
}
