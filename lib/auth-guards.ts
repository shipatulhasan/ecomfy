import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, type SessionUser } from "@/lib/auth";

/**
 * Data Access Layer for the session. Reads request headers, so callers must
 * render inside <Suspense> (Cache Components). Never call these from a
 * `"use cache"` scope — pass `user.id` into cached functions instead.
 */
/**
 * Authoritative: always checks the Session table (`disableCookieCache`), so a
 * revoked session (password reset, sign out elsewhere) or a role change applies
 * at once. Only proxy.ts uses the 5-minute signed cookie cache, as a fast first
 * filter. Deduped per request with React `cache`.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers(), query: { disableCookieCache: true } }),
);

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

export async function requireUser(redirectTo = "/sign-in"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/sign-in?callbackUrl=%2Fadmin");
  // Signed-in non-admins go home (forbidden() is still experimental in Next 16.4).
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
