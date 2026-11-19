import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { CART_COOKIE } from "@/lib/cart-cookie";
import { mergeGuestIntoUser } from "@/lib/cart/merge";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { consume } from "@/lib/rate-limit";
import { parseWishlistCookie, WISHLIST_COOKIE } from "@/lib/wishlist-cookie";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Forgot password → emailed link → /reset-password?token=… (1h, single use: the
    // Verification row is deleted on use). Every session is revoked on reset.
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Reset your {store} password",
        text: `Use this link within 1 hour to choose a new password: ${url}`,
        link: url,
      });
    },
  },
  // The account works right away; the dashboard shows a "verify your email" banner
  // until the link (24h) is opened. Opening it signs the user in.
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 24 * 60 * 60,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({
        to: user.email,
        subject: "Verify your {store} email",
        text: `Confirm your email address within 24 hours: ${url}`,
        link: url,
      });
    },
  },
  // Google is enabled only when credentials are configured, so local dev works without them.
  socialProviders:
    googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
  session: {
    // "Remember me" sessions last 30 days (refreshed daily). Without it the cookie
    // is a browser-session cookie and the DB session ends after 1 day.
    expiresIn: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
    // Sessions live in the DB (Session table). The signed cookie cache avoids a
    // DB round-trip on every request for 5 minutes; role changes apply after that.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // HTTP endpoints under /api/auth (Google callback, client calls). The server
  // actions in lib/actions/auth.ts apply their own per IP + email limits.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customStorage: { consume },
    customRules: {
      "/sign-in/*": { window: 15 * 60, max: 30 },
      "/sign-up/*": { window: 60 * 60, max: 10 },
      "/request-password-reset": { window: 60 * 60, max: 10 },
      "/send-verification-email": { window: 60 * 60, max: 10 },
      "/get-session": false,
      // TOTP / backup codes (sign-in second step, enable, disable). The plugin adds
      // its own 3 per 10 s burst rule on top.
      "/two-factor/*": { window: 15 * 60, max: 10 },
      "/change-password": { window: 15 * 60, max: 10 },
      "/change-email": { window: 60 * 60, max: 5 },
    },
  },
  advanced: {
    // httpOnly + SameSite=Lax are Better Auth defaults; Secure in production.
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  user: {
    // Admin General Info → E-mail. Verified emails: a confirmation link goes to the
    // CURRENT address first, then a verification link to the new one; the email
    // changes only when that is opened.
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        await sendMail({
          to: user.email,
          subject: "Confirm your {store} email change",
          text: `Someone (hopefully you) asked to change your email to ${newEmail}. Open this link within 24 hours to approve it: ${url}`,
          link: url,
        });
      },
    },
    additionalFields: {
      role: {
        type: ["CUSTOMER", "STAFF", "ADMIN"],
        defaultValue: "CUSTOMER",
        input: false, // never settable from sign-up payloads
      },
    },
  },
  // Deactivated staff (admin Control Authority) can't get a new session by any
  // route: email, Google, 2FA verify or the verification-link auto sign-in.
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { deactivatedAt: true } });
          if (user?.deactivatedAt) throw new APIError("FORBIDDEN", { message: "Invalid email or password." });
        },
      },
    },
  },
  hooks: {
    // Guest cart + wishlist → the account, right after a session is created by
    // sign-in or sign-up (email or social callback) or by opening the verification
    // link (auto sign-in). Then the guest cookies go.
    after: createAuthMiddleware(async (ctx) => {
      const userId = ctx.context.newSession?.user.id;
      if (!userId || !/^\/(sign-in\/|sign-up\/|callback\/|verify-email)/.test(ctx.path)) return;
      const guestToken = ctx.getCookie(CART_COOKIE);
      const guestWishlist = parseWishlistCookie(ctx.getCookie(WISHLIST_COOKIE));
      if (!guestToken && guestWishlist.length === 0) return;
      try {
        await mergeGuestIntoUser(userId, guestToken, guestWishlist);
      } catch (err) {
        // Never fail the sign-in over the merge; the guest cart stays in its cookie.
        console.error("[auth] guest cart merge failed", err);
        return;
      }
      if (guestToken) ctx.setCookie(CART_COOKIE, "", { path: "/", maxAge: 0 });
      if (guestWishlist.length > 0) ctx.setCookie(WISHLIST_COOKIE, "", { path: "/", maxAge: 0 });
    }),
  },
  // Must be last: lets server actions set auth cookies.
  plugins: [
    // Admin Security → 2FA (TOTP + backup codes). A sign-in for a user with 2FA on
    // returns { twoFactorRedirect } and sets a 10-minute two-factor cookie;
    // /admin/login/verify finishes it.
    twoFactor({ issuer: "Ecofy Admin" }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session["user"];
