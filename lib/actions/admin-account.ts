"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { readNotificationPrefs } from "@/lib/admin/notifications";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { getSession, requireStaff, type CurrentUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { deleteStoredImage, finalizeImage, presignTmpImage } from "@/lib/media/single-image";
import { limitAuthAttempt } from "@/lib/rate-limit";
import { uploadRequestSchema } from "@/lib/validations/admin-product";
import {
  adminProfileSchema,
  avatarSchema,
  changeEmailSchema,
  changePasswordSchema,
  notificationsSchema,
  passwordOnlySchema,
  sessionTokenSchema,
  totpCodeSchema,
} from "@/lib/validations/admin-account";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";
import type { z } from "zod";

/**
 * Admin General Info: the signed-in staff member's OWN account. Every action
 * resolves the user from the session (requireStaff) and writes only that row;
 * no schema here accepts a user id. Password, 2FA and email changes are rate
 * limited per user; 2FA and password changes are audited (never the secrets).
 */

type FormState<T = { message?: string }> = ActionResult<T> | null;
const fields = (fd: FormData, keys: readonly string[]) => Object.fromEntries(keys.map((k) => [k, fd.get(k) ?? undefined]));

/** runAction with the staff session resolved first (no session → admin login). */
async function runStaffAction<S extends z.ZodType, T>(schema: S, input: unknown, fn: (data: z.infer<S>, user: CurrentUser) => Promise<T>) {
  const user = await requireStaff("/admin/settings");
  return runAction(schema, input, (data) => fn(data, user));
}

const apiError = (err: unknown, message: string): never => {
  if (err instanceof APIError) throw new ActionError(message);
  throw err;
};

// ───────────────────────────── profile ─────────────────────────────

export async function updateProfileAction(input: unknown): Promise<ActionResult<void>> {
  return runStaffAction(adminProfileSchema, input, async (d, user) => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, phone: true, dateOfBirth: true, location: true, bio: true } });
    const data = {
      name: [d.firstName, d.lastName].filter(Boolean).join(" "),
      phone: d.phone || null,
      dateOfBirth: d.dateOfBirth ? new Date(`${d.dateOfBirth}T00:00:00Z`) : null,
      location: d.location || null,
      bio: d.bio || null,
    };
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data });
      await logAudit({ actorId: user.id, action: "account.profile", entity: "User", entityId: user.id, before, after: data }, tx);
    });
  });
}

/** Verified email: confirmation to the current address, then verification of the new one. */
export async function requestEmailChangeAction(input: unknown): Promise<ActionResult<{ message: string }>> {
  return runStaffAction(changeEmailSchema, input, async ({ newEmail }, user) => {
    const limited = await limitAuthAttempt("email-change", user.id);
    if (limited) throw new ActionError(limited);
    if (newEmail === user.email) throw new ActionError("That's already your email.", { newEmail: ["Same as now"] });
    try {
      await auth.api.changeEmail({ body: { newEmail, callbackURL: "/admin/settings?tab=profile&email=changed" }, headers: await headers() });
    } catch (err) {
      apiError(err, "Couldn't start the email change. Try again later.");
    }
    await logAudit({ actorId: user.id, action: "account.email.request", entity: "User", entityId: user.id, after: { newEmail } });
    return {
      message: user.emailVerified
        ? `We sent a confirmation link to ${user.email}. After you approve it, ${newEmail} gets a link to verify; your email changes then.`
        : `We sent a verification link to ${newEmail}. Your email changes once you open it.`,
    };
  });
}

// ───────────────────────────── password ─────────────────────────────

/** Change Password card. Signs out every other session. */
export async function changePasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runStaffAction(changePasswordSchema, fields(fd, ["currentPassword", "newPassword", "confirmPassword"]), async (d, user) => {
    const limited = await limitAuthAttempt("password-change", user.id);
    if (limited) throw new ActionError(limited);
    // Better Auth's revokeOtherSessions replaces THIS session too (new cookie), which
    // the page re-render after the action can't see yet → it would bounce to login.
    // So: change the password, then delete every other session ourselves.
    const current = (await getSession())?.session.id;
    try {
      await auth.api.changePassword({
        body: { currentPassword: d.currentPassword, newPassword: d.newPassword, revokeOtherSessions: false },
        headers: await headers(),
      });
    } catch (err) {
      if (err instanceof APIError) throw new ActionError("Please fix the highlighted fields.", { currentPassword: ["That's not your current password"] });
      throw err;
    }
    const revoked = await prisma.session.deleteMany({ where: { userId: user.id, ...(current && { id: { not: current } }) } });
    await logAudit({ actorId: user.id, action: "account.password", entity: "User", entityId: user.id, after: { otherSessionsRevoked: revoked.count } });
    return { message: "Password changed. You've been signed out on your other devices." };
  });
}

// ───────────────────────────── avatar (Neon) ─────────────────────────────

export async function getAvatarUploadUrl(input: unknown): Promise<ActionResult<{ key: string; url: string; maxMb: number }>> {
  return runStaffAction(uploadRequestSchema.pick({ mime: true, size: true }), input, ({ mime, size }) => presignTmpImage(mime, size));
}

/** "Upload New" (key) or "Delete" (null). The old image is deleted after the swap. */
export async function setAvatarAction(input: unknown): Promise<ActionResult<{ image: string | null }>> {
  return runStaffAction(avatarSchema, input, async ({ key }, user) => {
    const image = key ? await finalizeImage(key, "avatar", user.id) : null;
    const prev = (await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { image: true } })).image;
    await prisma.user.update({ where: { id: user.id }, data: { image } });
    if (prev && prev !== image) await deleteStoredImage(prev);
    return { image };
  });
}

// ───────────────────────────── 2FA (TOTP) ─────────────────────────────

/** Step 1: password → secret (QR + text) and backup codes. 2FA turns on after step 2. */
export async function startTwoFactorAction(input: unknown): Promise<ActionResult<{ qr: string; secret: string; backupCodes: string[] }>> {
  return runStaffAction(passwordOnlySchema, input, async ({ password }, user) => {
    const limited = await limitAuthAttempt("two-factor", user.id);
    if (limited) throw new ActionError(limited);
    let res: { totpURI: string; backupCodes: string[] } | undefined;
    try {
      res = (await auth.api.enableTwoFactor({ body: { password }, headers: await headers() })) as { totpURI: string; backupCodes: string[] };
    } catch (err) {
      apiError(err, "That password isn't right, or 2FA is already on.");
    }
    const secret = new URL(res!.totpURI).searchParams.get("secret") ?? "";
    const qr = await QRCode.toDataURL(res!.totpURI, { margin: 1, width: 220 });
    return { qr, secret, backupCodes: res!.backupCodes };
  });
}

/** Step 2: the first code from the app → 2FA on (Better Auth rotates this session). */
export async function confirmTwoFactorAction(input: unknown): Promise<ActionResult<void>> {
  return runStaffAction(totpCodeSchema, input, async ({ code }, user) => {
    const limited = await limitAuthAttempt("two-factor", user.id);
    if (limited) throw new ActionError(limited);
    try {
      await auth.api.verifyTOTP({ body: { code }, headers: await headers() });
    } catch (err) {
      apiError(err, "That code didn't match. Check the time on your phone and try the current code.");
    }
    await logAudit({ actorId: user.id, action: "account.2fa.enable", entity: "User", entityId: user.id });
  });
}

export async function disableTwoFactorAction(input: unknown): Promise<ActionResult<void>> {
  return runStaffAction(passwordOnlySchema, input, async ({ password }, user) => {
    const limited = await limitAuthAttempt("two-factor", user.id);
    if (limited) throw new ActionError(limited);
    try {
      await auth.api.disableTwoFactor({ body: { password }, headers: await headers() });
    } catch (err) {
      apiError(err, "That password isn't right.");
    }
    await logAudit({ actorId: user.id, action: "account.2fa.disable", entity: "User", entityId: user.id });
  });
}

export async function regenerateBackupCodesAction(input: unknown): Promise<ActionResult<{ backupCodes: string[] }>> {
  return runStaffAction(passwordOnlySchema, input, async ({ password }, user) => {
    const limited = await limitAuthAttempt("two-factor", user.id);
    if (limited) throw new ActionError(limited);
    let res: { backupCodes: string[] } | undefined;
    try {
      res = (await auth.api.generateBackupCodes({ body: { password }, headers: await headers() })) as { backupCodes: string[] };
    } catch (err) {
      apiError(err, "That password isn't right.");
    }
    await logAudit({ actorId: user.id, action: "account.2fa.backup-codes", entity: "User", entityId: user.id });
    return { backupCodes: res!.backupCodes };
  });
}

// ───────────────────────────── sessions ─────────────────────────────

/** One of my other sessions (by id; the token never leaves the server). */
export async function revokeSessionAction(input: unknown): Promise<ActionResult<void>> {
  return runStaffAction(sessionTokenSchema, input, async ({ id }, user) => {
    const current = (await getSession())?.session.id;
    if (id === current) throw new ActionError("Use Log out to end this session.");
    const n = await prisma.session.deleteMany({ where: { id, userId: user.id } });
    if (n.count !== 1) throw new ActionError("That session already ended.");
    await logAudit({ actorId: user.id, action: "account.session.revoke", entity: "User", entityId: user.id, after: { sessionId: id } });
  });
}

export async function revokeOtherSessionsAction(): Promise<ActionResult<{ count: number }>> {
  const user = await requireStaff("/admin/settings");
  const current = (await getSession())?.session.id;
  if (!current) return { ok: false, error: "Your session ended. Sign in again." };
  const n = await prisma.session.deleteMany({ where: { userId: user.id, id: { not: current } } });
  await logAudit({ actorId: user.id, action: "account.session.revoke-others", entity: "User", entityId: user.id, after: { count: n.count } });
  return { ok: true, data: { count: n.count } };
}

// ───────────────────────────── notifications ─────────────────────────────

export async function saveNotificationsAction(input: unknown): Promise<ActionResult<void>> {
  return runStaffAction(notificationsSchema, input, async (prefs, user) => {
    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { notificationPrefs: true } });
    await prisma.user.update({ where: { id: user.id }, data: { notificationPrefs: prefs } });
    await logAudit({ actorId: user.id, action: "account.notifications", entity: "User", entityId: user.id, before: readNotificationPrefs(row.notificationPrefs), after: prefs });
  });
}
