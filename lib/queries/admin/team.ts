import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { SUPER_ADMIN_ROLE_ID } from "@/lib/admin/roles";
import type { MemberStatusFilter } from "@/lib/admin/team/params";
import { requirePermission } from "@/lib/auth-guards";
import { CacheTags } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";

/**
 * Control Authority reads. Each entry point checks `users:manage`, then calls a
 * short-lived cached function (tag `admin-members`; team actions updateTag it).
 * "Last active" is the newest Session.updatedAt (sessions refresh daily), so it's
 * accurate to about a day — good enough for a team list.
 */

export type TeamRole = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  permissions: string[];
  isSystem: boolean;
  activeUsers: number;
};

export async function getStaffRoles(): Promise<TeamRole[]> {
  await requirePermission("users:manage");
  return staffRolesCached();
}

async function staffRolesCached(): Promise<TeamRole[]> {
  "use cache";
  cacheTag(CacheTags.adminMembers);
  cacheLife("minutes");
  const roles = await prisma.staffRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      icon: true,
      permissions: true,
      isSystem: true,
      _count: { select: { users: { where: { role: { in: ["STAFF", "ADMIN"] }, deactivatedAt: null } } } },
    },
  });
  return roles.map(({ _count, ...r }) => ({ ...r, activeUsers: _count.users }));
}

export type TeamMemberRow = {
  kind: "member";
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: "STAFF" | "ADMIN";
  staffRoleId: string | null;
  staffRoleName: string;
  active: boolean;
  lastActiveAt: Date | null;
  createdAt: Date;
};

export type TeamInviteRow = {
  kind: "invite";
  id: string;
  name: string;
  email: string;
  staffRoleId: string | null;
  staffRoleName: string;
  invitedBy: string | null;
  expiresAt: Date;
  createdAt: Date;
};

export type TeamFilters = { q: string; staffRoleId: string | null; status: MemberStatusFilter };

export async function getTeamMembers(filters: TeamFilters) {
  await requirePermission("users:manage");
  return teamMembersCached(filters.q, filters.staffRoleId, filters.status);
}

async function teamMembersCached(q: string, staffRoleId: string | null, status: MemberStatusFilter) {
  "use cache";
  cacheTag(CacheTags.adminMembers);
  cacheLife("minutes");

  const text = q
    ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const roleWhere: Prisma.UserWhereInput = staffRoleId
    ? staffRoleId === SUPER_ADMIN_ROLE_ID
      ? { role: "ADMIN" }
      : { role: "STAFF", staffRoleId }
    : {};

  const members: TeamMemberRow[] =
    status === "invited"
      ? []
      : (
          await prisma.user.findMany({
            where: {
              role: { in: ["STAFF", "ADMIN"] },
              ...roleWhere,
              ...text,
              ...(status === "active" && { deactivatedAt: null }),
              ...(status === "deactivated" && { deactivatedAt: { not: null } }),
            },
            orderBy: [{ role: "asc" }, { name: "asc" }],
            take: 300,
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              role: true,
              staffRoleId: true,
              deactivatedAt: true,
              createdAt: true,
              staffRole: { select: { name: true } },
              sessions: { orderBy: { updatedAt: "desc" }, take: 1, select: { updatedAt: true } },
            },
          })
        ).map((u) => ({
          kind: "member",
          id: u.id,
          name: u.name,
          email: u.email,
          image: u.image,
          role: u.role as "STAFF" | "ADMIN",
          staffRoleId: u.role === "ADMIN" ? SUPER_ADMIN_ROLE_ID : u.staffRoleId,
          staffRoleName: u.role === "ADMIN" ? "Super Admin" : (u.staffRole?.name ?? "No role"),
          active: !u.deactivatedAt,
          lastActiveAt: u.sessions[0]?.updatedAt ?? null,
          createdAt: u.createdAt,
        }));

  const invites: TeamInviteRow[] =
    status === "all" || status === "invited"
      ? (
          await prisma.adminInvite.findMany({
            where: {
              acceptedAt: null,
              revokedAt: null,
              expiresAt: { gt: new Date() },
              ...(staffRoleId && { staffRoleId }),
              ...(q && {
                OR: [
                  { email: { contains: q, mode: "insensitive" as const } },
                  { firstName: { contains: q, mode: "insensitive" as const } },
                  { lastName: { contains: q, mode: "insensitive" as const } },
                ],
              }),
            },
            orderBy: { createdAt: "desc" },
            take: 100,
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
              staffRoleId: true,
              expiresAt: true,
              createdAt: true,
              staffRole: { select: { name: true } },
              invitedBy: { select: { name: true } },
            },
          })
        ).map((i) => ({
          kind: "invite",
          id: i.id,
          name: [i.firstName, i.lastName].filter(Boolean).join(" "),
          email: i.email,
          staffRoleId: i.staffRoleId,
          staffRoleName: i.staffRole?.name ?? (i.role === "ADMIN" ? "Super Admin" : "Staff"),
          invitedBy: i.invitedBy?.name ?? null,
          expiresAt: i.expiresAt,
          createdAt: i.createdAt,
        }))
      : [];

  return { members, invites };
}

/** Members of one role (Members chips on the right card). */
export async function getRoleMembers(staffRoleId: string) {
  await requirePermission("users:manage");
  return roleMembersCached(staffRoleId);
}

async function roleMembersCached(staffRoleId: string) {
  "use cache";
  cacheTag(CacheTags.adminMembers);
  cacheLife("minutes");
  return prisma.user.findMany({
    where: staffRoleId === SUPER_ADMIN_ROLE_ID ? { role: "ADMIN" } : { role: "STAFF", staffRoleId },
    orderBy: [{ deactivatedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
    take: 60,
    select: { id: true, name: true, email: true, image: true, deactivatedAt: true },
  });
}

/** Security Logs: team, role, invite and settings changes. */
export const SECURITY_LOG_ENTITIES = ["User", "AdminInvite", "StaffRole", "Settings", "ShippingZone"] as const;
export const SECURITY_LOGS_PER_PAGE = 25;

export async function getSecurityLogs(page: number) {
  await requirePermission("users:manage");
  return securityLogsCached(page);
}

async function securityLogsCached(page: number) {
  "use cache";
  cacheTag(CacheTags.adminMembers, CacheTags.settings);
  cacheLife("seconds");
  const where = { entity: { in: [...SECURITY_LOG_ENTITIES] } };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * SECURITY_LOGS_PER_PAGE,
      take: SECURITY_LOGS_PER_PAGE,
      select: { id: true, action: true, entity: true, entityId: true, before: true, after: true, ip: true, createdAt: true, actor: { select: { name: true, email: true } } },
    }),
  ]);
  return { total, pages: Math.max(1, Math.ceil(total / SECURITY_LOGS_PER_PAGE)), rows };
}
