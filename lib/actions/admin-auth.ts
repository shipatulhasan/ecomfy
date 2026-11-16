"use server";

import { randomUUID } from "node:crypto";
import { APIError } from "better-auth/api";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { findUsableInvite, hashInviteToken, usableInviteWhere } from "@/lib/admin/invites";
import { logAudit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { isStaffRole } from "@/lib/auth/permissions";
import { safeAdminCallbackUrl } from "@/lib/callback-url";
import { prisma } from "@/lib/db";
import { clearAuthAttempts, limitAuthAttempt, pruneRateLimits } from "@/lib/rate-limit";
import { acceptInviteSchema, adminSignInSchema } from "@/lib/validations/admin";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Admin Login / forgot + reset password / invite acceptance / sign out.
 *
 * Same Better Auth instance and session cookie as the storefront; the admin flows
 * differ in that:
 * - only STAFF / ADMIN accounts can sign in here. A CUSTOMER (or unknown email)
 *   gets the same generic message as a wrong password, and no session is created;
 * - rate limits are stricter ("admin-*" buckets in lib/rate-limit.ts);
 * - there is no public sign-up: /admin/register needs an invite token.
 *
 * TOTP (deferred): a second step would go between the password check and the
 * redirect in adminSignInAction.
 */
type FormState = ActionResult<{ message?: string }> | null;

const fields = (fd: FormData, keys: readonly string[]) =>
  Object.fromEntries(keys.map((k) => [k, fd.get(k) ?? undefined]));

const INVALID_CREDENTIALS = "Invalid email or password.";
const INVALID_INVITE = "This invitation link is invalid or has expired. Ask an admin for a new invite.";

// Hash of a throwaway password: non-staff sign-ins still pay for one scrypt check,
// so response time doesn't reveal which emails are staff accounts.
let dummyHash: Promise<string> | null = null;
const timingDummy = () => (dummyHash ??= hashPassword(randomUUID()));

export async function adminSignInAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(
    adminSignInSchema,
    fields(fd, ["email", "password", "rememberMe", "callbackUrl"]),
    async ({ email, password, rememberMe, callbackUrl }) => {
      const limited = await limitAuthAttempt("admin-sign-in", email);
      if (limited) throw new ActionError(limited);

      const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
      if (!user || !isStaffRole(user.role)) {
        await verifyPassword({ hash: await timingDummy(), password }).catch(() => false);
        throw new ActionError(INVALID_CREDENTIALS);
      }

      try {
        await auth.api.signInEmail({
          body: { email, password, rememberMe: rememberMe ?? false },
          headers: await headers(),
        });
      } catch (err) {
        if (err instanceof APIError) throw new ActionError(INVALID_CREDENTIALS);
        throw err;
      }
      await clearAuthAttempts("admin-sign-in", email);
      void pruneRateLimits().catch(() => {});
      redirect(safeAdminCallbackUrl(callbackUrl));
    },
  );
}

export async function adminRequestPasswordResetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(forgotPasswordSchema, fields(fd, ["email"]), async ({ email }) => {
    const limited = await limitAuthAttempt("admin-reset", email);
    if (limited) throw new ActionError(limited);
    // Only staff accounts get a link from here; the answer is the same either way.
    const user = await prisma.user.findUnique({ where: { email }, select: { role: true } });
    if (user && isStaffRole(user.role)) {
      try {
        await auth.api.requestPasswordReset({
          body: { email, redirectTo: "/admin/reset-password" },
          headers: await headers(),
        });
      } catch (err) {
        if (!(err instanceof APIError)) throw err;
        console.error("[admin-auth] password reset request failed", err.status);
      }
    }
    return { message: "If a staff account exists for that email, we've sent a link to reset the password. It expires in 1 hour." };
  });
}

export async function adminResetPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(
    resetPasswordSchema,
    fields(fd, ["token", "password", "confirmPassword"]),
    async ({ token, password }) => {
      try {
        await auth.api.resetPassword({ body: { token, newPassword: password }, headers: await headers() });
      } catch (err) {
        if (err instanceof APIError) {
          throw new ActionError("This reset link is invalid or has expired. Request a new one.");
        }
        throw err;
      }
      redirect("/admin/login?reset=1");
    },
  );
}

/**
 * Register.png with ?token=: creates the staff account the invite describes.
 * Single use under races: the invite is claimed with a conditional updateMany in
 * the same transaction that creates the account. An existing customer account with
 * that email is promoted (the link proves the email), its password replaced and
 * its sessions revoked.
 */
export async function acceptInviteAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(
    acceptInviteSchema,
    fields(fd, ["token", "password", "confirmPassword", "acceptTerms"]),
    async ({ token, password }) => {
      const limited = await limitAuthAttempt("admin-invite", hashInviteToken(token).slice(0, 16));
      if (limited) throw new ActionError(limited);

      const invite = await findUsableInvite(prisma, token);
      if (!invite) throw new ActionError(INVALID_INVITE);

      const hash = await hashPassword(password);
      const now = new Date();
      const name = [invite.firstName, invite.lastName].filter(Boolean).join(" ");

      await prisma.$transaction(async (tx) => {
        const claimed = await tx.adminInvite.updateMany({
          where: { id: invite.id, ...usableInviteWhere(now) },
          data: { acceptedAt: now },
        });
        if (claimed.count !== 1) throw new ActionError(INVALID_INVITE);

        const existing = await tx.user.findUnique({
          where: { email: invite.email },
          select: { id: true, role: true, accounts: { where: { providerId: "credential" }, select: { id: true } } },
        });

        let userId: string;
        if (existing) {
          if (isStaffRole(existing.role)) throw new ActionError("This email already has a staff account. Sign in instead.");
          userId = existing.id;
          await tx.user.update({
            where: { id: userId },
            data: { role: invite.role, emailVerified: true, ...(invite.phone ? { phone: invite.phone } : {}) },
          });
          const credential = existing.accounts[0];
          if (credential) await tx.account.update({ where: { id: credential.id }, data: { password: hash } });
          else {
            await tx.account.create({
              data: { id: randomUUID(), accountId: userId, providerId: "credential", password: hash, userId },
            });
          }
          await tx.session.deleteMany({ where: { userId } });
        } else {
          userId = randomUUID();
          await tx.user.create({
            data: {
              id: userId,
              name,
              email: invite.email,
              emailVerified: true, // the invite link was opened from this inbox
              role: invite.role,
              phone: invite.phone,
              accounts: {
                create: { id: randomUUID(), accountId: userId, providerId: "credential", password: hash },
              },
            },
          });
        }
        await tx.adminInvite.update({ where: { id: invite.id }, data: { acceptedUserId: userId } });
        await logAudit(
          {
            actorId: userId,
            action: "invite.accept",
            entity: "AdminInvite",
            entityId: invite.id,
            before: existing ? { userId, role: existing.role } : null,
            after: { userId, email: invite.email, role: invite.role },
          },
          tx,
        );
      });

      redirect("/admin/login?registered=1");
    },
  );
}

/** Sidebar "Log out" and the avatar menu. */
export async function adminSignOutAction(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (err) {
    if (!(err instanceof APIError)) throw err;
  }
  redirect("/admin/login");
}
