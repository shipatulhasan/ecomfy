"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/auth-guards";
import { safeCallbackUrl } from "@/lib/callback-url";
import { clearAuthAttempts, limitAuthAttempt, pruneRateLimits } from "@/lib/rate-limit";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validations/auth";
import { ActionError, type ActionResult } from "./result";
import { runAction } from "./safe-action";

/**
 * Sign in / sign up / forgot + reset password / resend verification / sign out.
 *
 * - Forms post FormData through useActionState: (previous state, FormData).
 * - Each call is rate limited per IP + email and per IP (lib/rate-limit.ts), before
 *   Better Auth is touched.
 * - Messages never reveal whether an email has an account.
 * - Better Auth's `nextCookies()` plugin sets the session cookie from these actions,
 *   and its after-hook (lib/auth.ts) merges the guest cart + wishlist.
 * - CSRF: server actions only accept same-origin POSTs (Next checks Origin against Host).
 */
type FormState = ActionResult<{ message?: string }> | null;

const fields = (fd: FormData, keys: readonly string[]) =>
  Object.fromEntries(keys.map((k) => [k, fd.get(k) ?? undefined]));

const INVALID_CREDENTIALS = "Invalid email or password.";
const SIGN_UP_FAILED =
  "We couldn't create an account with these details. If you already have one, sign in or reset your password.";

export async function signInAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(
    signInSchema,
    fields(fd, ["email", "password", "rememberMe", "callbackUrl"]),
    async ({ email, password, rememberMe, callbackUrl }) => {
      const limited = await limitAuthAttempt("sign-in", email);
      if (limited) throw new ActionError(limited);
      let res: unknown;
      try {
        res = await auth.api.signInEmail({
          body: { email, password, rememberMe: rememberMe ?? false },
          headers: await headers(),
        });
      } catch (err) {
        if (err instanceof APIError) throw new ActionError(INVALID_CREDENTIALS);
        throw err;
      }
      await clearAuthAttempts("sign-in", email);
      void pruneRateLimits().catch(() => {});
      // Only staff can turn on 2FA (admin General Info → Security): finish on the admin verify step.
      if (res && typeof res === "object" && "twoFactorRedirect" in res && res.twoFactorRedirect) redirect("/admin/login/verify");
      redirect(safeCallbackUrl(callbackUrl));
    },
  );
}

export async function signUpAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(
    signUpSchema,
    fields(fd, ["email", "password", "confirmPassword", "acceptTerms", "callbackUrl"]),
    async ({ email, password, name, callbackUrl }) => {
      const limited = await limitAuthAttempt("sign-up", email);
      if (limited) throw new ActionError(limited);
      try {
        await auth.api.signUpEmail({
          body: {
            name: name || nameFromEmail(email),
            email,
            password,
            // Where the verification link lands (it signs the user in, then the banner is gone).
            callbackURL: "/account?verified=1",
          },
          headers: await headers(),
        });
      } catch (err) {
        if (err instanceof APIError) throw new ActionError(SIGN_UP_FAILED);
        throw err;
      }
      redirect(safeCallbackUrl(callbackUrl));
    },
  );
}

export async function requestPasswordResetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(forgotPasswordSchema, fields(fd, ["email"]), async ({ email }) => {
    const limited = await limitAuthAttempt("reset", email);
    if (limited) throw new ActionError(limited);
    try {
      // Better Auth answers the same way for unknown emails (and sends nothing).
      await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: await headers() });
    } catch (err) {
      if (!(err instanceof APIError)) throw err;
      console.error("[auth] password reset request failed", err.status);
    }
    return { message: "If an account exists for that email, we've sent a link to reset the password. It expires in 1 hour." };
  });
}

export async function resetPasswordAction(_prev: FormState, fd: FormData): Promise<FormState> {
  return runAction(
    resetPasswordSchema,
    fields(fd, ["token", "password", "confirmPassword"]),
    async ({ token, password }) => {
      try {
        // Single use; revokes every session of the account (lib/auth.ts).
        await auth.api.resetPassword({ body: { token, newPassword: password }, headers: await headers() });
      } catch (err) {
        if (err instanceof APIError) {
          throw new ActionError("This reset link is invalid or has expired. Request a new one.");
        }
        throw err;
      }
      redirect("/sign-in?reset=1");
    },
  );
}

/** "Verify your email" banner → send the link again. */
export async function resendVerificationAction(): Promise<FormState> {
  const user = await requireUser();
  if (user.emailVerified) return { ok: true, data: { message: "Your email is already verified." } };
  const limited = await limitAuthAttempt("verify", user.email);
  if (limited) return { ok: false, error: limited };
  try {
    await auth.api.sendVerificationEmail({
      body: { email: user.email, callbackURL: "/account?verified=1" },
      headers: await headers(),
    });
  } catch (err) {
    console.error("[auth] resend verification failed", err instanceof APIError ? err.status : err);
    return { ok: false, error: "Couldn't send the email. Please try again." };
  }
  return { ok: true, data: { message: `We've sent a new link to ${user.email}.` } };
}

/** Account nav "Log-out": ends the session (DB row + cookie), then home. */
export async function signOutAction(): Promise<void> {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (err) {
    // No session (already signed out): nothing to clear.
    if (!(err instanceof APIError)) throw err;
  }
  redirect("/");
}

/** "dianne.russell+shop@x.com" → "Dianne Russell". Editable in Settings. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0]!.split("+")[0]!;
  const words = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return (words.join(" ") || "Customer").slice(0, 100);
}
