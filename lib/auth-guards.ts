import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth, type SessionUser } from "@/lib/auth";
import { can, isAssignablePermission, isStaffRole, PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
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

/**
 * The session user plus what the admin needs: `permissions` (ADMIN: all; STAFF:
 * their StaffRole's) and the role's display name. A deactivated staff member is
 * signed out (null). Customers skip the extra query.
 */
export type CurrentUser = SessionUser & { permissions: readonly Permission[]; staffRoleName: string | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const user = (await getSession())?.user;
  if (!user) return null;
  if (!isStaffRole(user.role)) return { ...user, permissions: [], staffRoleName: null };
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { deactivatedAt: true, staffRole: { select: { name: true, permissions: true } } },
  });
  if (!row || row.deactivatedAt) return null;
  const permissions =
    user.role === "ADMIN" ? PERMISSIONS : (row.staffRole?.permissions ?? []).filter(isAssignablePermission);
  return { ...user, permissions, staffRoleName: row.staffRole?.name ?? (user.role === "ADMIN" ? "Super Admin" : null) };
});

export async function requireUser(redirectTo = "/sign-in"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

/**
 * Admin panel pages (app/admin/(panel)/layout.tsx). No session, or a CUSTOMER
 * session → the admin login, back to `callbackUrl` afterwards.
 */
export async function requireStaff(callbackUrl = "/admin"): Promise<CurrentUser> {
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
export async function requirePermission(permission: Permission | readonly Permission[]): Promise<CurrentUser> {
  const user = await requireStaff();
  const any = typeof permission === "string" ? [permission] : permission; // any one of them
  if (!any.some((p) => can(user, p))) throw new ActionError(FORBIDDEN);
  return user;
}

/** Full admin rights (ADMIN role). Prefer requirePermission() for specific checks. */
export async function requireAdmin(): Promise<CurrentUser> {
  return requirePermission("users:manage");
}
