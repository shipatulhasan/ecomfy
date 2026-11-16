import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, type SessionUser } from "@/lib/auth";
import { can, isStaffRole, type Permission } from "@/lib/auth/permissions";
import { ActionError, FORBIDDEN } from "@/lib/actions/result";

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

/**
 * Admin panel pages (app/admin/(panel)/layout.tsx). No session, or a CUSTOMER
 * session → the admin login, back to `callbackUrl` afterwards.
 */
export async function requireStaff(callbackUrl = "/admin"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) {
    redirect(`/admin/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  return user;
}

/**
 * Every admin server action and admin query entry point. Not staff → admin login;
 * staff without the permission → ActionError(FORBIDDEN) (runAction turns it into
 * `{ ok: false, error: FORBIDDEN }`). Pages check `can()` and render <Forbidden />.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireStaff();
  if (!can(user, permission)) throw new ActionError(FORBIDDEN);
  return user;
}

/** Full admin rights (ADMIN role). Prefer requirePermission() for specific checks. */
export async function requireAdmin(): Promise<SessionUser> {
  return requirePermission("users:manage");
}
