import { z } from "zod";
import { isAssignablePermission } from "@/lib/auth/permissions";
import { isRoleIconKey } from "@/lib/admin/roles";

const id = z.string().trim().min(1).max(64);

/** Create / Edit role modal. */
export const roleFormSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2, "At least 2 characters").max(40, "At most 40 characters"),
  description: z.string().trim().max(160, "At most 160 characters").optional().default(""),
  icon: z.string().refine(isRoleIconKey, "Pick an icon").default("user"),
  /** Create only (Create New Role.png: Permissions × Module checkboxes). */
  permissions: z
    .array(z.string())
    .max(64)
    .refine((ps) => ps.every(isAssignablePermission), "Unknown permission")
    .optional(),
});

/** Permissions table → Save. Unknown or admin-only permissions are rejected. */
export const rolePermissionsSchema = z.object({
  id,
  permissions: z
    .array(z.string())
    .max(64)
    .refine((ps) => ps.every(isAssignablePermission), "Unknown permission"),
});

export const roleIdSchema = z.object({ id });

export const memberRoleSchema = z.object({ userId: id, staffRoleId: id });
export const memberActiveSchema = z.object({ userId: id, active: z.boolean() });
export const memberIdSchema = z.object({ userId: id });

export type RoleFormInput = z.infer<typeof roleFormSchema>;
