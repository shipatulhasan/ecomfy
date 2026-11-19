/**
 * Admin permissions. Pure (no server-only): the shell filters its menu with it and
 * every admin server action / query re-checks it via requirePermission()
 * (lib/auth-guards.ts). proxy.ts only checks "is staff" as a first gate.
 *
 * Roles live in the DB (StaffRole, admin Control Authority):
 * - User.role ADMIN = the system "Super Admin" role: every permission.
 * - User.role STAFF = `user.staffRole.permissions`, resolved once per request by
 *   getCurrentUser() (lib/auth-guards.ts) onto `user.permissions`.
 * - CUSTOMER: none.
 * `can()` stays synchronous; callers pass the user from requireStaff / runAdminAction.
 */
export const PERMISSIONS = [
  "dashboard:read",
  "orders:read",
  "orders:update",
  "orders:refund", // manual refunds
  "products:read",
  "products:create",
  "products:update",
  "products:delete",
  "categories:read",
  "categories:create",
  "categories:update",
  "categories:delete",
  "customers:read",
  "customers:update",
  "coupons:read",
  "coupons:create",
  "coupons:update",
  "coupons:delete",
  "payments:read", // admin Transactions (STAFF sees masked customer contact)
  "payments:reconcile", // "Verify with gateway"
  "payments:export", // Transactions CSV
  "settings:write", // Super Admin only
  "users:manage", // Super Admin only
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type Role = "CUSTOMER" | "STAFF" | "ADMIN";

/** Only the Super Admin (User.role ADMIN) has these; a custom role can't be given them. */
export const ADMIN_ONLY_PERMISSIONS = ["settings:write", "users:manage"] as const satisfies readonly Permission[];

export const ASSIGNABLE_PERMISSIONS = PERMISSIONS.filter(
  (p) => !(ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(p),
) as Exclude<Permission, (typeof ADMIN_ONLY_PERMISSIONS)[number]>[];

export function isAssignablePermission(p: string): p is Permission {
  return (ASSIGNABLE_PERMISSIONS as string[]).includes(p);
}

export type MatrixAction = "view" | "create" | "edit" | "delete";
export const MATRIX_ACTIONS: { key: MatrixAction; label: string }[] = [
  { key: "view", label: "View" },
  { key: "create", label: "Create" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
];

/**
 * Control Authority → Permissions table (Add Members.png): one row per module,
 * columns View / Create / Edit / Delete. `null` = no such action (disabled cell).
 */
export const PERMISSION_MODULES: {
  key: string;
  label: string;
  icon: "dashboard" | "products" | "orders" | "customers" | "coupons" | "categories" | "transactions";
  cells: Record<MatrixAction, Permission | null>;
}[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard", cells: { view: "dashboard:read", create: null, edit: null, delete: null } },
  {
    key: "products",
    label: "Products",
    icon: "products",
    cells: { view: "products:read", create: "products:create", edit: "products:update", delete: "products:delete" },
  },
  { key: "orders", label: "Order Management", icon: "orders", cells: { view: "orders:read", create: null, edit: "orders:update", delete: null } },
  { key: "customers", label: "Customers", icon: "customers", cells: { view: "customers:read", create: null, edit: "customers:update", delete: null } },
  {
    key: "coupons",
    label: "Coupon Code",
    icon: "coupons",
    cells: { view: "coupons:read", create: "coupons:create", edit: "coupons:update", delete: "coupons:delete" },
  },
  {
    key: "categories",
    label: "Categories",
    icon: "categories",
    cells: { view: "categories:read", create: "categories:create", edit: "categories:update", delete: "categories:delete" },
  },
  { key: "transactions", label: "Transaction", icon: "transactions", cells: { view: "payments:read", create: null, edit: "payments:reconcile", delete: null } },
];

/** Assignable permissions outside the matrix (shown under it). */
export const EXTRA_PERMISSIONS: { permission: Permission; label: string }[] = [
  { permission: "orders:refund", label: "Issue refunds" },
  { permission: "payments:export", label: "Export transactions (CSV)" },
];

/** Write permissions that need their module's view permission too. */
export function withImpliedReads(perms: readonly Permission[]): Permission[] {
  const out = new Set(perms);
  for (const m of PERMISSION_MODULES) {
    const view = m.cells.view;
    if (view && (["create", "edit", "delete"] as const).some((a) => m.cells[a] && out.has(m.cells[a]!))) out.add(view);
  }
  if (out.has("orders:refund")) out.add("orders:read");
  if (out.has("payments:export")) out.add("payments:read");
  return PERMISSIONS.filter((p) => out.has(p));
}

export const ROLE_LABELS: Record<Role, string> = { CUSTOMER: "Customer", STAFF: "Staff", ADMIN: "Super Admin" };

/** STAFF and ADMIN may enter the admin panel. */
export function isStaffRole(role: string | null | undefined): role is "STAFF" | "ADMIN" {
  return role === "STAFF" || role === "ADMIN";
}

export type PermissionSubject = { role?: string | null; permissions?: readonly string[] | null } | null | undefined;

export function can(user: PermissionSubject, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role !== "STAFF") return false;
  return (user.permissions ?? []).includes(permission) && !(ADMIN_ONLY_PERMISSIONS as readonly string[]).includes(permission);
}

/** Any one of them. */
export function canAny(user: PermissionSubject, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => can(user, p));
}
