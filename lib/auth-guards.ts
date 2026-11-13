import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type SessionUser } from "@/lib/auth";

/**
 * Data Access Layer for the session. Reads request headers, so callers must
 * render inside <Suspense> (Cache Components). Never call these from a
 * `"use cache"` scope — pass `user.id` into cached functions instead.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

export async function requireUser(redirectTo = "/sign-in"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(redirectTo);
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/sign-in?next=/admin");
  // Signed-in non-admins go home (forbidden() is still experimental in Next 16.4).
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
