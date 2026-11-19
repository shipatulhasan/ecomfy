/**
 * Control Authority roles (StaffRole). Pure: shared by actions, scripts and UI.
 * The seeded ids come from prisma/migrations/*_team_settings.
 */
export const SUPER_ADMIN_ROLE_ID = "role_super_admin";
export const DEFAULT_STAFF_ROLE_ID = "role_manager";

/** User.role that goes with a StaffRole. */
export const userRoleFor = (staffRoleId: string): "ADMIN" | "STAFF" => (staffRoleId === SUPER_ADMIN_ROLE_ID ? "ADMIN" : "STAFF");

/** Role list icons (Add Members.png: house, person, pencil, headset). Keys stored in StaffRole.icon. */
export const ROLE_ICON_KEYS = ["shield", "manager", "editor", "support", "user", "box", "truck", "chart"] as const;
export type RoleIconKey = (typeof ROLE_ICON_KEYS)[number];
export const isRoleIconKey = (v: string): v is RoleIconKey => (ROLE_ICON_KEYS as readonly string[]).includes(v);
