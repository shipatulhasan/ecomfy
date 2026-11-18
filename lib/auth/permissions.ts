/**
 * Admin permissions. Pure (no server-only): the shell filters its menu with it and
 * every admin server action / query re-checks it via requirePermission()
 * (lib/auth-guards.ts). proxy.ts only checks "is staff" as a first gate.
 *
 * Roles are static for now; the Control Authority screen (custom roles) will move
 * this map into the DB later — keep callers on can() so that change stays local.
 */
export const PERMISSIONS = [
  "dashboard:read",
  "orders:read",
  "orders:update",
  "orders:refund", // manual refunds (ADMIN only)
  "products:read",
  "products:write",
  "categories:read",
  "categories:write",
  "customers:read",
  "coupons:write",
  "payments:read",
  "settings:write",
  "users:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type Role = "CUSTOMER" | "STAFF" | "ADMIN";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  CUSTOMER: [],
  STAFF: [
    "dashboard:read",
    "orders:read",
    "orders:update",
    "products:read",
    "products:write",
    "categories:read", // read-only: creating / editing categories is ADMIN-only
    "customers:read",
  ],
  ADMIN: PERMISSIONS,
};

export const ROLE_LABELS: Record<Role, string> = { CUSTOMER: "Customer", STAFF: "Staff", ADMIN: "Admin" };

/** STAFF and ADMIN may enter the admin panel. */
export function isStaffRole(role: string | null | undefined): role is "STAFF" | "ADMIN" {
  return role === "STAFF" || role === "ADMIN";
}

export function can(user: { role?: string | null } | null | undefined, permission: Permission): boolean {
  const role = user?.role;
  if (role !== "CUSTOMER" && role !== "STAFF" && role !== "ADMIN") return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}
